from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional

# ================= CONFIGURACIÓN =================
SECRET_KEY = "c2763d58-ae6d-460f-84e3-2798fc7ce719"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

app = FastAPI()

# CORS: Vital para Tailscale Funnel
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
    db.execute("CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, series_id TEXT NOT NULL, episode_id TEXT NOT NULL, time REAL NOT NULL, duration REAL NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, series_id, episode_id))")
    
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

# ================= RUTAS DE AUTENTICACIÓN =================

@app.post("/login")
async def login(data: LoginData):
    print(f"DEBUG: Intentando login para: {data.username}")
    db = get_db()
    row = db.execute("SELECT id, password FROM users WHERE username = ?", (data.username,)).fetchone()
    
    # SI NO EXISTE EL USUARIO -> ERROR (Quitamos el registro automático)
    if row is None:
        db.close()
        print("DEBUG: Usuario no encontrado")
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # SI LA CONTRASEÑA NO COINCIDE -> ERROR
    if not verify_password(data.password, row["password"]):
        db.close()
        print("DEBUG: Contraseña incorrecta")
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
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
        INSERT INTO progress (user_id, series_id, episode_id, time, duration) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(user_id, series_id, episode_id) 
        DO UPDATE SET time=excluded.time, duration=excluded.duration, updated_at=CURRENT_TIMESTAMP
    """, (user_id, data.series_id, data.episode_id, data.time, data.duration))
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

@app.get("/favorites")
async def get_favorites(user_id: int = Depends(get_current_user)):
    db = get_db()
    # Ahora solo seleccionamos series_id porque es lo único que guardamos
    rows = db.execute("SELECT series_id FROM favorites WHERE user_id=?", (user_id,)).fetchall()
    db.close()
    
    # Devolvemos una lista de objetos con seriesId para que el JS lo entienda
    return [{"seriesId": r["series_id"]} for r in rows]
    
@app.post("/favorites")
async def toggle_favorite(data: dict, user_id: int = Depends(get_current_user)):
    db = get_db()
    # Buscamos si ya es favorito solo por ID de serie
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