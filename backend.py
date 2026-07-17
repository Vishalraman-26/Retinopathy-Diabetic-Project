from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi import UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import time
from functools import lru_cache
import os
import sqlite3
import hashlib
import secrets
import uuid
import json

import torch
from torchvision import models, transforms
from PIL import Image
import io
import numpy as np
import cv2
import joblib
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Removed in-memory PATIENTS list, using app.db

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    doctor_name: str
    hospital_name: str

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    medical_id: str


LABELS = [
    "No DR",
    "Mild NPDR",
    "Moderate NPDR",
    "Severe NPDR",
    "PDR",
]

FEATURES_BY_LABEL = {
    "No DR": ["Macula appears normal with no visible abnormalities.", "Optic disc margins are sharp and well-defined.", "Vascular arcades show regular caliber without tortuosity."],
    "Mild NPDR": ["Microaneurysms detected primarily in the macular region.", "No significant dot-and-blot hemorrhages visible.", "Hard exudates absent or minimal."],
    "Moderate NPDR": ["Multiple microaneurysms and dot-and-blot hemorrhages present.", "Cotton wool spots (soft exudates) identified in the perimacular area.", "Mild venous caliber changes detected."],
    "Severe NPDR": ["Extensive intraretinal hemorrhages (matching 4-2-1 rule criteria).", "Definite venous beading observed in multiple quadrants.", "Intraretinal Microvascular Abnormalities (IRMA) present."],
    "PDR": ["Neovascularization at the disc (NVD) detected.", "Neovascularization elsewhere (NVE) visible along the major vascular arcades.", "Pre-retinal hemorrhage or fibrous proliferation observed."],
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _resolve_existing(*candidates: str) -> str:
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError(f"None of these paths exist: {candidates}")


DB_PATH = os.path.join(BASE_DIR, "app.db")
SVM_SKLEARN_PATH = os.path.join(BASE_DIR, "best_svm_model_sklearn.joblib")
APSO_IDX_PATH = os.path.join(BASE_DIR, "apso_selected_features.npy")
X_TRAIN_PATH = os.path.join(BASE_DIR, "X_train.npy")
Y_TRAIN_PATH = os.path.join(BASE_DIR, "y_train.npy")
X_VAL_PATH = os.path.join(BASE_DIR, "X_val.npy")
Y_VAL_PATH = os.path.join(BASE_DIR, "y_val.npy")

RNET_PATH = _resolve_existing(
    os.path.join(BASE_DIR, "best_rnet.pt"),
    os.path.join(BASE_DIR, "best_rnet (1).pt"),
)
GNET_PATH = _resolve_existing(
    os.path.join(BASE_DIR, "best_gnet.pt"),
    os.path.join(BASE_DIR, "best_gnet (1).pt"),
)

SESSIONS: dict[str, str] = {}


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            doctor_name TEXT,
            hospital_name TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    try:
        conn.execute("ALTER TABLE users ADD COLUMN doctor_name TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN hospital_name TEXT")
    except sqlite3.OperationalError:
        pass

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            medical_id TEXT,
            doctor_name TEXT,
            hospital_name TEXT,
            last_visit_date TEXT
        )
        """
    )
    try:
        conn.execute("ALTER TABLE patients ADD COLUMN hospital_name TEXT")
    except sqlite3.OperationalError:
        pass
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            date TEXT,
            diagnosis TEXT,
            confidence REAL,
            processing_time_ms INTEGER,
            features TEXT,
            image_data TEXT,
            FOREIGN KEY(patient_id) REFERENCES patients(id)
        )
        """
    )
    conn.commit()
    return conn


def _hash_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    return hashlib.sha256(salt + password.encode("utf-8")).hexdigest()


def _create_user(username: str, password: str, doctor_name: str, hospital_name: str) -> None:
    salt_hex = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt_hex)
    conn = _db()
    try:
        conn.execute(
            "INSERT INTO users(username, salt, password_hash, doctor_name, hospital_name, created_at) VALUES(?,?,?,?,?,datetime('now'))",
            (username, salt_hex, pw_hash, doctor_name, hospital_name),
        )
        conn.commit()
    finally:
        conn.close()


def _verify_user(username: str, password: str) -> bool:
    conn = _db()
    try:
        row = conn.execute(
            "SELECT salt, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row:
            return False
        salt_hex, pw_hash = row
        return secrets.compare_digest(_hash_password(password, salt_hex), pw_hash)
    finally:
        conn.close()


def require_auth(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.split(" ", 1)[1].strip()
    username = SESSIONS.get(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    return username


def _extract_fc_features(model: torch.nn.Module, x: torch.Tensor) -> torch.Tensor:
    feats: dict[str, torch.Tensor] = {}

    def pre_hook(_module, inputs):
        feats["v"] = inputs[0].detach()

    handle = model.fc.register_forward_pre_hook(pre_hook)
    try:
        _ = model(x)
    finally:
        handle.remove()

    v = feats.get("v")
    if v is None:
        raise RuntimeError("Failed to capture features")
    return v.flatten(1)


def preprocess_final_bgr(img_bgr: np.ndarray) -> np.ndarray:
    """
    Implements the user's preprocessing pipeline:
    green channel -> gaussian blur correction -> normalize -> tophat -> CLAHE -> 3ch.
    Input: BGR uint8 image (OpenCV)
    Output: 3-channel uint8 image (still OpenCV array)
    """
    green = img_bgr[:, :, 1]

    blur = cv2.GaussianBlur(green, (0, 0), sigmaX=8)
    corrected = cv2.addWeighted(green, 1.0, blur, -0.5, 0)
    corrected = cv2.normalize(corrected, None, 0, 255, cv2.NORM_MINMAX)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    tophat = cv2.morphologyEx(corrected, cv2.MORPH_TOPHAT, kernel)

    enhanced = corrected + 0.3 * tophat
    enhanced = np.clip(enhanced, 0, 255).astype(np.uint8)

    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    final = clahe.apply(enhanced)

    final_3ch = cv2.merge([final, final, final])
    return final_3ch


@lru_cache(maxsize=1)
def _get_models():
    device = torch.device("cpu")

    rnet = models.resnet18(weights=None, num_classes=5)
    rnet_sd = torch.load(RNET_PATH, map_location="cpu")
    rnet.load_state_dict(rnet_sd, strict=True)
    rnet.eval().to(device)

    gnet = models.googlenet(weights=None, aux_logits=False, num_classes=5)
    gnet_sd = torch.load(GNET_PATH, map_location="cpu")
    gnet.load_state_dict(gnet_sd, strict=True)
    gnet.eval().to(device)

    preprocess = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    return {"device": device, "rnet": rnet, "gnet": gnet, "preprocess": preprocess}


@lru_cache(maxsize=1)
def _get_apso_idx() -> np.ndarray:
    idx = np.load(APSO_IDX_PATH)
    idx = np.asarray(idx).astype(np.int64)
    if idx.ndim != 1:
        idx = idx.ravel()
    return idx


@lru_cache(maxsize=1)
def _get_svm_classifier() -> CalibratedClassifierCV:
    if os.path.exists(SVM_SKLEARN_PATH):
        obj = joblib.load(SVM_SKLEARN_PATH)
        return obj["model"]

    idx = _get_apso_idx()
    X_train = np.load(X_TRAIN_PATH, mmap_mode="r")[:, idx]
    y_train = np.load(Y_TRAIN_PATH, mmap_mode="r")
    X_val = np.load(X_VAL_PATH, mmap_mode="r")[:, idx]
    y_val = np.load(Y_VAL_PATH, mmap_mode="r")

    svc = LinearSVC(C=1.0, class_weight="balanced")
    svc.fit(X_train, y_train)

    cal = CalibratedClassifierCV(svc, cv="prefit", method="sigmoid")
    cal.fit(X_val, y_val)

    joblib.dump({"model": cal, "apso_idx": idx}, SVM_SKLEARN_PATH)
    return cal


@app.post("/api/infer/")
async def infer(file: UploadFile = File(...), _username: str = Depends(require_auth)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image (jpeg/png).")

    raw = await file.read()
    try:
        arr = np.frombuffer(raw, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("imdecode failed")
        pre = preprocess_final_bgr(bgr)
        img = Image.fromarray(cv2.cvtColor(pre, cv2.COLOR_BGR2RGB))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    bundle = _get_models()
    idx = _get_apso_idx()
    clf = _get_svm_classifier()
    t0 = time.perf_counter()
    x = bundle["preprocess"](img).unsqueeze(0).to(bundle["device"])

    with torch.no_grad():
        fr = _extract_fc_features(bundle["rnet"], x).cpu().numpy()  # (1, 512)
        fg = _extract_fc_features(bundle["gnet"], x).cpu().numpy()  # (1, 1024)
        feats = np.concatenate([fg, fr], axis=1)  # (1, 1536)
        selected = feats[:, idx]  # (1, 100)
        proba = clf.predict_proba(selected)[0]
        classes = clf.classes_.astype(int)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    best_pos = int(np.argmax(proba))
    pred_class = int(classes[best_pos])
    label = LABELS[pred_class]
    confidence = float(proba[best_pos])

    top_order = np.argsort(-proba)
    top_k = []
    for pos in top_order[: min(3, len(top_order))]:
        c = int(classes[pos])
        top_k.append(f"{LABELS[c]} ({float(proba[pos]) * 100:.1f}%)")

    return {
        "label": label,
        "label_index": pred_class,
        "confidence": confidence,
        "probabilities": {LABELS[int(c)]: float(proba[i]) for i, c in enumerate(classes)},
        "processing_time_ms": elapsed_ms,
        "features": [
            *FEATURES_BY_LABEL.get(label, []),
            f"APSO selected features used: {int(idx.shape[0])}",
            f"Top predictions: {', '.join(top_k)}",
        ],
    }

@app.post("/api/auth/register/")
def register(req: RegisterRequest):
    username = req.username.strip().lower()
    if not username or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    if not req.doctor_name or not req.hospital_name:
        raise HTTPException(status_code=400, detail="Doctor name and hospital name are required")
    try:
        _create_user(username, req.password, req.doctor_name.strip(), req.hospital_name.strip())
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="User already exists")
    return {"ok": True}


@app.post("/api/auth/login/")
def login(req: LoginRequest):
    username = req.username.strip().lower()
    if _verify_user(username, req.password):
        token = uuid.uuid4().hex
        SESSIONS[token] = username
        return {"access": token, "refresh": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/patients/")
def get_patients(_username: str = Depends(require_auth)):
    conn = _db()
    try:
        rows = conn.execute("SELECT * FROM patients ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

@app.post("/api/patients/")
def create_patient(patient: PatientCreate, _username: str = Depends(require_auth)):
    conn = _db()
    try:
        user = conn.execute("SELECT doctor_name, hospital_name FROM users WHERE username = ?", (_username,)).fetchone()
        doctor_name = user["doctor_name"] if user and user["doctor_name"] else "Admin"
        hospital_name = user["hospital_name"] if user and user["hospital_name"] else "Unknown Hospital"
        
        cursor = conn.execute(
            "INSERT INTO patients (first_name, last_name, medical_id, doctor_name, hospital_name) VALUES (?, ?, ?, ?, ?)",
            (patient.first_name, patient.last_name, patient.medical_id, doctor_name, hospital_name)
        )
        conn.commit()
        patient_id = cursor.lastrowid
        return {
            "id": patient_id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "medical_id": patient.medical_id,
            "doctor_name": doctor_name,
            "hospital_name": hospital_name,
            "last_visit_date": None,
            "visits": []
        }
    finally:
        conn.close()

@app.get("/api/patients/{patient_id}/")
def get_patient(patient_id: int, _username: str = Depends(require_auth)):
    conn = _db()
    try:
        p_row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        patient_dict = dict(p_row)
        v_rows = conn.execute("SELECT * FROM visits WHERE patient_id = ? ORDER BY id DESC", (patient_id,)).fetchall()
        visits = []
        for v in v_rows:
            v_dict = dict(v)
            if v_dict["features"]:
                v_dict["features"] = json.loads(v_dict["features"])
            else:
                v_dict["features"] = []
            visits.append(v_dict)
            
        patient_dict["visits"] = visits
        return patient_dict
    finally:
        conn.close()

class VisitCreate(BaseModel):
    diagnosis: str
    confidence: float
    processing_time_ms: int
    features: List[str]
    image_base64: str

@app.post("/api/patients/{patient_id}/visits/")
def add_visit(patient_id: int, visit: VisitCreate, _username: str = Depends(require_auth)):
    conn = _db()
    try:
        # Verify patient exists
        if not conn.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Patient not found")
            
        date_str = datetime.utcnow().isoformat() + "Z"
        features_json = json.dumps(visit.features)
        
        cursor = conn.execute(
            """
            INSERT INTO visits (patient_id, date, diagnosis, confidence, processing_time_ms, features, image_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (patient_id, date_str, visit.diagnosis, visit.confidence, visit.processing_time_ms, features_json, visit.image_base64)
        )
        visit_id = cursor.lastrowid
        
        # Update patient last_visit_date
        conn.execute("UPDATE patients SET last_visit_date = ? WHERE id = ?", (date_str, patient_id))
        conn.commit()
        
        return {
            "id": visit_id,
            "patient_id": patient_id,
            "date": date_str,
            "diagnosis": visit.diagnosis,
            "confidence": visit.confidence,
            "processing_time_ms": visit.processing_time_ms,
            "features": visit.features,
            "image_data": visit.image_base64
        }
    finally:
        conn.close()

@app.delete("/api/patients/{patient_id}/visits/{visit_id}/")
def delete_visit(patient_id: int, visit_id: int, _username: str = Depends(require_auth)):
    conn = _db()
    try:
        # Check if visit exists for this patient
        row = conn.execute("SELECT id FROM visits WHERE id = ? AND patient_id = ?", (visit_id, patient_id)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Visit not found")
            
        conn.execute("DELETE FROM visits WHERE id = ?", (visit_id,))
        
        # Update last_visit_date
        latest_visit = conn.execute("SELECT date FROM visits WHERE patient_id = ? ORDER BY id DESC LIMIT 1", (patient_id,)).fetchone()
        if latest_visit:
            conn.execute("UPDATE patients SET last_visit_date = ? WHERE id = ?", (latest_visit["date"], patient_id))
        else:
            conn.execute("UPDATE patients SET last_visit_date = NULL WHERE id = ?", (patient_id,))
            
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
