
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional
from collections import defaultdict
import time

# ================= CONFIGURACIÓN =================
SECRET_KEY = "c2763d58-ae6d-460f-84e3-2798fc7ce719"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

app = FastAPI()

# Manejador global para devolver errores como texto plano (sin JSON {"detail": ...})
# y conservar cabeceras como Retry-After para el 429.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code, headers=exc.headers)

# CORS: sin cambios (tu configuración actual)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ================= BASE DE DATOS =================
def get_db():
    conn = sqlite3.connect("webseries.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    db = get_db()
    db.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)")
    db.execute("""
    CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER NOT NULL, 
        series_id TEXT NOT NULL, 
        episode_id TEXT NOT NULL, 
        episode_title TEXT, 
        url TEXT, 
        time REAL NOT NULL, 
        duration REAL NOT NULL, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        UNIQUE(user_id, series_id, episode_id)
    )
""")
    
    # TABLA DE FAVORITOS ACTUALIZADA (Sin obligar a tener episode_id)
    db.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id INTEGER NOT NULL, 
            series_id TEXT NOT NULL, 
            UNIQUE(user_id, series_id)
        )
    """)
    db.commit()
    db.close()

init_db()

# ================= MODELOS PREDEFINIDOS =================
class LoginData(BaseModel):
    username: str
    password: str

class ProgressData(BaseModel):
    series_id: str
    episode_id: str
    episode_title: Optional[str] = None  # Opcional con valor por defecto
    url: Optional[str] = None            # Opcional con valor por defecto
    time: float
    duration: float

# ================= HELPERS =================
def hash_password(password: str): return pwd_context.hash(password)
def verify_password(password: str, hashed: str): return pwd_context.verify(password, hashed)

def create_token(user_id: int):
    payload = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ================= RATE LIMITING (1 MINUTO, 5 INTENTOS) =================
ATTEMPTS = defaultdict(list)  # ip -> [timestamps]
MAX_ATTEMPTS = 5
WINDOW = 60  # 1 minuto

def client_ip(req: Request) -> str:
    # Prioriza IP real si viene de Cloudflare / proxies; si no, usa la del cliente
    return (
        req.headers.get("cf-connecting-ip")
        or req.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (req.client.host if req.client else "unknown")
    )

def remaining_lock_seconds(timestamps: list, now: float) -> int:
    """
    Calcula los segundos restantes de bloqueo dentro de la ventana.
    Se asume timestamps ya filtrados a la ventana actual.
    """
    if not timestamps:
        return 0
    # El bloqueo dura WINDOW desde el primer intento en la ventana
    elapsed = now - timestamps[0]
    rem = int(WINDOW - elapsed)
    return rem if rem > 0 else 0

# ================= RUTAS DE AUTENTICACIÓN =================

@app.post("/login")
async def login(data: LoginData, request: Request):
    ip = client_ip(request)
    now = time.time()
    # limpia ventana de intentos antiguos
    ATTEMPTS[ip] = [t for t in ATTEMPTS[ip] if now - t < WINDOW]

    # Si ya está bloqueado por superar el límite dentro de la ventana
    if len(ATTEMPTS[ip]) >= MAX_ATTEMPTS:
        rem = remaining_lock_seconds(ATTEMPTS[ip], now)
        if rem <= 0:
            # ventana expirada, resetea contador
            ATTEMPTS[ip] = []
        else:
            # bloqueado: devolver 429 con Retry-After y mensaje plano con countdown
            raise HTTPException(
                status_code=429,
                detail=f"Demasiados intentos. Espera {rem} segundos.",
                headers={"Retry-After": str(rem)}
            )

    db = get_db()
    row = db.execute("SELECT id, password FROM users WHERE username = ?", (data.username,)).fetchone()
    
    # Usuario no encontrado
    if row is None:
        db.close()
        ATTEMPTS[ip].append(now)  # cuenta intento fallido
        # Si alcanza el límite, informa del tiempo restante
        if len(ATTEMPTS[ip]) >= MAX_ATTEMPTS:
            rem = remaining_lock_seconds(ATTEMPTS[ip], now)
            raise HTTPException(
                status_code=429,
                detail=f"Demasiados intentos. Espera {rem} segundos.",
                headers={"Retry-After": str(rem)}
            )
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Contraseña incorrecta
    if not verify_password(data.password, row["password"]):
        db.close()
        ATTEMPTS[ip].append(now)  # cuenta intento fallido
        # Si alcanza el límite, informa del tiempo restante
        if len(ATTEMPTS[ip]) >= MAX_ATTEMPTS:
            rem = remaining_lock_seconds(ATTEMPTS[ip], now)
            raise HTTPException(
                status_code=429,
                detail=f"Demasiados intentos. Espera {rem} segundos.",
                headers={"Retry-After": str(rem)}
            )
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Éxito: resetea contador para esa IP
    ATTEMPTS[ip] = []

    user_id = row["id"]
    db.close()
    return {"token": create_token(user_id)}

@app.post("/register")
async def register(data: LoginData):
    db = get_db()
    if db.execute("SELECT id FROM users WHERE username = ?", (data.username,)).fetchone():
        db.close()
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed = hash_password(data.password)
    cur = db.execute("INSERT INTO users (username, password) VALUES (?, ?)", (data.username, hashed))
    db.commit()
    user_id = cur.lastrowid
    db.close()
    return {"token": create_token(user_id)}

@app.get("/me")
async def me(user_id: int = Depends(get_current_user)):
    db = get_db()
    row = db.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    db.close()
    return {"user_id": user_id, "username": row["username"]}

# ================= RUTAS DE PROGRESO Y FAVORITOS =================

@app.post("/progress")
async def save_progress(data: ProgressData, user_id: int = Depends(get_current_user)):
    db = get_db()
    db.execute("""
        INSERT INTO progress (user_id, series_id, episode_id, episode_title, url, time, duration) 
        VALUES (?, ?, ?, ?, ?, ?, ?) 
        ON CONFLICT(user_id, series_id, episode_id) 
        DO UPDATE SET 
            time=excluded.time, 
            duration=excluded.duration, 
            episode_title=excluded.episode_title,
            url=excluded.url,
            updated_at=CURRENT_TIMESTAMP
    """, (user_id, data.series_id, data.episode_id, data.episode_title, data.url, data.time, data.duration))
    db.commit()
    db.close()
    return {"ok": True}

@app.get("/progress/{series_id}/{episode_id}")
async def get_progress(series_id: str, episode_id: str, user_id: int = Depends(get_current_user)):
    db = get_db()
    row = db.execute("SELECT time, duration FROM progress WHERE user_id=? AND series_id=? AND episode_id=?", 
                    (user_id, series_id, episode_id)).fetchone()
    db.close()
    if row:
        return {"time": row["time"], "duration": row["duration"]}
    return None

@app.get("/continue-watching")
async def get_continue_watching(user_id: int = Depends(get_current_user)):
    db = get_db()
    # Cambiamos el filtro: Que aparezca si se ha visto algo, 
    # pero que desaparezca si faltan menos de 30 segundos para el final
    rows = db.execute("""
        SELECT series_id, episode_id, episode_title, url, time, duration 
        FROM progress 
        WHERE user_id = ? 
          AND time > 5 
          AND (duration - time) > 30
        ORDER BY updated_at DESC LIMIT 3
    """, (user_id,)).fetchall()
    db.close()
    return [dict(r) for r in rows]
    
@app.delete("/progress/{series_id}/{episode_id}")
async def delete_progress(series_id: str, episode_id: str, user_id: int = Depends(get_current_user)):
    db = get_db()
    db.execute(
        "DELETE FROM progress WHERE user_id = ? AND series_id = ? AND episode_id = ?",
        (user_id, series_id, episode_id)
    )
    db.commit()
    db.close()
    return {"status": "deleted"}

@app.get("/series-progress/{series_id}")
async def get_series_progress(series_id: str, user_id: int = Depends(get_current_user)):
    db = get_db()
    # Obtenemos todos los episodios de esta serie donde el tiempo sea casi el total
    # o donde simplemente exista progreso (tú decides el filtro)
    rows = db.execute("""
        SELECT episode_id FROM progress 
        WHERE user_id = ? AND series_id = ? AND (duration - time) < 30
    """, (user_id, series_id)).fetchall()
    db.close()
    return [r["episode_id"] for r in rows]

@app.get("/favorites")
async def get_favorites(user_id: int = Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT series_id FROM favorites WHERE user_id=?", (user_id,)).fetchall()
    db.close()
    return [{"seriesId": r["series_id"]} for r in rows]
    
@app.post("/favorites")
async def toggle_favorite(data: dict, user_id: int = Depends(get_current_user)):
    db = get_db()
    row = db.execute("SELECT id FROM favorites WHERE user_id=? AND series_id=?", 
                    (user_id, data["seriesId"])).fetchone()
    
    if row:
        db.execute("DELETE FROM favorites WHERE id=?", (row["id"],))
        action = "removed"
    else:
        db.execute("INSERT INTO favorites (user_id, series_id) VALUES (?,?)", 
                  (user_id, data["seriesId"]))
        action = "added"
    
    db.commit()
    db.close()
    return {"status": action}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000, log_level="warning")
