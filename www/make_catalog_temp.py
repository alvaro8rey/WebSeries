# -*- coding: utf-8 -*-
import os, json, sys, re

# --- CONFIGURACIÓN ---
BASE_DIR_SERIES = r"D:\Series_HLS"
BASE_DIR_PELIS = r"D:\Peliculas_HLS"

catalog = {
    "title": "Catálogo Completo",
    "series": [],
    "movies": []
}

def read_file_content(path, filename, default=""):
    file_path = os.path.join(path, filename)
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                return f.read().strip()
        except: pass
    return default

def normalize_for_url(text):
    s = text.lower()
    replacements = (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n"))
    for a, b in replacements:
        s = s.replace(a, b)
    s = re.sub(r'[^a-z0-9_\-]', '_', s)
    s = re.sub(r'_+', '_', s)
    return s.strip('_')

# --- PROCESAR SERIES ---
if os.path.exists(BASE_DIR_SERIES):
    for serie_folder in sorted(os.listdir(BASE_DIR_SERIES)):
        path = os.path.join(BASE_DIR_SERIES, serie_folder)
        if not os.path.isdir(path): continue

        # Obtenemos la fecha de la carpeta de la serie
        mtime = os.path.getmtime(path)

        item = {
            "id": normalize_for_url(serie_folder),
            "title": read_file_content(path, "title.txt", serie_folder),
            "lang": read_file_content(path, "lang.txt", "es").lower(),
            "type": "serie",
            "updated_at": mtime  # <--- NUEVO CAMPO
        }

        season_dirs = [d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d)) and "Season" in d]
        
        if season_dirs:
            item["seasons"] = []
            for sn in sorted(season_dirs):
                sn_path = os.path.join(path, sn)
                m = re.search(r"(\d+)", sn)
                sn_num = int(m.group(1)) if m else 1
                season_obj = {"season": sn_num, "title": sn, "episodes": []}
                
                for ep in sorted(os.listdir(sn_path)):
                    ep_path = os.path.join(sn_path, ep)
                    if os.path.exists(os.path.join(ep_path, "index.m3u8")):
                        season_obj["episodes"].append({
                            "id": ep,
                            "title": read_file_content(ep_path, "title.txt", ep),
                            "url": f"/Series_HLS/{serie_folder}/{sn}/{ep}/index.m3u8"
                        })
                if season_obj["episodes"]: item["seasons"].append(season_obj)
        else:
            item["episodes"] = []
            for ep in sorted(os.listdir(path)):
                ep_path = os.path.join(path, ep)
                if os.path.isdir(ep_path) and os.path.exists(os.path.join(ep_path, "index.m3u8")):
                    item["episodes"].append({
                        "id": ep,
                        "title": read_file_content(ep_path, "title.txt", ep),
                        "url": f"/Series_HLS/{serie_folder}/{ep}/index.m3u8"
                    })

        if item.get("seasons") or item.get("episodes"):
            catalog["series"].append(item)

# --- PROCESAR PELÍCULAS ---
if os.path.exists(BASE_DIR_PELIS):
    for peli_folder in sorted(os.listdir(BASE_DIR_PELIS)):
        path = os.path.join(BASE_DIR_PELIS, peli_folder)
        if not os.path.isdir(path): continue
        
        if os.path.exists(os.path.join(path, "index.m3u8")):
            # Obtenemos la fecha de la carpeta de la película
            mtime = os.path.getmtime(path)
            
            catalog["movies"].append({
                "id": normalize_for_url(peli_folder),
                "title": read_file_content(path, "title.txt", peli_folder),
                "lang": read_file_content(path, "lang.txt", "es").lower(),
                "url": f"/Peliculas_HLS/{peli_folder}/index.m3u8",
                "type": "movie",
                "updated_at": mtime, # <--- NUEVO CAMPO
                "description": read_file_content(path, "sinopsis.txt", "Sin sinopsis disponible."),
                "year": read_file_content(path, "year.txt", "")
            })

# Guardar
with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"✅ Catálogo generado con fechas: {len(catalog['series'])} series y {len(catalog['movies'])} películas.")