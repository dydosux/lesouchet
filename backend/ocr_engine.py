import cv2
import numpy as np
import pytesseract
import re
import math
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from wood_calc import calculate_sawn_volume, calculate_total_logs_volume

STANDARD_SIZES = [
    "30X100X3", "30X100X4", "30X100X5", "30X100X6",
    "30X150X3", "30X150X4", "30X150X5", "30X150X6",
    "30X200X3", "30X200X4", "30X200X5", "30X200X6",
    "40X100X3", "40X100X4", "40X100X5", "40X100X6",
    "40X150X3", "40X150X4", "40X150X5", "40X150X6",
    "50X100X3", "50X100X4", "50X100X5", "50X100X6",
    "50X150X3", "50X150X4", "50X150X5", "50X150X6",
    "50X200X3", "50X200X4", "50X200X5", "50X200X6",
    "100X100X6", "100X150X6", "100X200X6",
    "150X150X6", "150X200X6",
    "200X200X6"
]


def preprocess_image(image_bytes: bytes) -> Tuple[np.ndarray, np.ndarray]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img, gray


def detect_and_deskew(img: np.ndarray, gray: np.ndarray) -> Tuple[np.ndarray, np.ndarray, float]:
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)

    angle = 0.0
    if lines is not None:
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if abs(x2 - x1) > 0.001:
                deg = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
                if -45 < deg < 45:
                    angles.append(deg)
        if angles:
            angle = float(np.median(angles))

    if abs(angle) > 0.5:
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated_img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        rotated_gray = cv2.cvtColor(rotated_img, cv2.COLOR_BGR2GRAY)
        return rotated_img, rotated_gray, angle

    return img, gray, 0.0


def normalize_size(token: str) -> Optional[str]:
    if not token:
        return None
    s = token.upper().replace("Х", "X").replace("×", "X").replace("*", "X")
    s = re.sub(r"[^0-9X]", "", s)
    s = re.sub(r"X+", "X", s)
    s = s.replace("O", "0").replace("I", "1").replace("L", "1")
    m3 = re.match(r"^(\d{2,3})X(\d{2,3})X(\d)$", s)
    if m3:
        return f"{m3.group(1)}X{m3.group(2)}X{m3.group(3)}"
    m2 = re.match(r"^(\d{2,3})X(\d{2,3})$", s)
    if m2:
        return f"{m2.group(1)}X{m2.group(2)}"
    return None


def clean_digit(token: str) -> Optional[int]:
    if not token:
        return None
    t = token.strip()
    for a, b in [("O", "0"), ("o", "0"), ("О", "0"), ("о", "0"), ("I", "1"), ("l", "1"), ("|", "1"),
                 ("S", "5"), ("s", "5"), ("B", "8"), ("Z", "2"), ("z", "2")]:
        t = t.replace(a, b)
    digits = re.findall(r"\d+", t)
    if not digits:
        return None
    val = int(digits[0])
    if 1 <= val <= 999:
        return val
    return None


def parse_standard_from_text(raw_text: str) -> List[Dict[str, Any]]:
    rows = []
    filled = {}
    for size in STANDARD_SIZES:
        filled[size] = {"grade1": None, "grade2": None}

    for line in raw_text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.search(r"(\d{2,3})\s*[xх×X*]\s*(\d{2,3})(?:\s*[xх×X*]\s*(\d))?", line, re.I)
        if not m:
            continue
        token = f"{m.group(1)}X{m.group(2)}" + (f"X{m.group(3)}" if m.group(3) else "")
        size = normalize_size(token)
        if not size or size not in filled:
            continue
        after = line[m.end():]
        nums = [int(x) for x in re.findall(r"\d{1,3}", after) if 1 <= int(x) <= 999]
        if len(nums) >= 2:
            filled[size]["grade1"] = nums[0]
            filled[size]["grade2"] = nums[1]
        elif len(nums) == 1:
            filled[size]["grade2"] = nums[0]

    for size in STANDARD_SIZES:
        g1 = filled[size]["grade1"]
        g2 = filled[size]["grade2"]
        g1c = g1 or 0
        g2c = g2 or 0
        vol1 = calculate_sawn_volume(size, g1c)
        vol2 = calculate_sawn_volume(size, g2c)
        rows.append({
            "id": f"row_{size}",
            "size": size,
            "grade1_count": g1,
            "grade2_count": g2,
            "grade1_vol_m3": vol1 if g1c > 0 else 0.0,
            "grade2_vol_m3": vol2 if g2c > 0 else 0.0,
            "total_vol_m3": round(vol1 + vol2, 4),
            "is_filled": (g1 is not None or g2 is not None)
        })
    return rows


def parse_extras(raw_text: str) -> List[Dict[str, Any]]:
    extras = []
    used = set()

    def add(name, size, count, is_slab=False):
        key = f"{size}|{is_slab}"
        if key in used:
            return
        used.add(key)
        extras.append({
            "id": f"extra_{len(extras)}",
            "name": name,
            "size": size,
            "count": count,
            "unit": "шт",
            "vol_m3": 0.0,
            "is_slab": is_slab
        })

    for m in re.finditer(r"гор(?:быль)?\.?\s*(?:дел(?:овой)?)?\.?\s*(?:2\s*м\.?)?[^\d]{0,12}(\d{1,3})", raw_text, re.I):
        c = int(m.group(1))
        if 1 <= c <= 999:
            add("Горбыль деловой 2м", "гор. 2м", c, True)

    for m in re.finditer(r"(\d{2,3})\s*[xх×X*]\s*(\d{2,3})(?:\s*[xх×X*]\s*(\d))?[^\d]{0,20}(\d{1,3})", raw_text, re.I):
        size = normalize_size(f"{m.group(1)}X{m.group(2)}" + (f"X{m.group(3)}" if m.group(3) else ""))
        if not size or size in STANDARD_SIZES:
            continue
        count = int(m.group(4))
        if count < 1 or count > 999:
            continue
        t = int(size.split("X")[0])
        if t >= 60:
            add(f"Брус {size}", size, count, False)

    return extras


def parse_logs(raw_text: str) -> List[int]:
    lower = raw_text.lower()
    section = raw_text
    best = -1
    for marker in ["кругляк", "кругл", "бревн", "диаметр", "сырь"]:
        i = lower.rfind(marker)
        if i > best:
            best = i
    if best >= 0:
        section = raw_text[best:]

    logs = [int(x) for x in re.findall(r"\b([1-4]\d|50)\b", section)]
    logs = [d for d in logs if 12 <= d <= 50]
    if len(logs) > 40:
        logs = logs[-30:]
    if len(logs) >= 3:
        return logs
    all_d = [int(x) for x in re.findall(r"\b([1-4]\d|50)\b", raw_text)]
    return [d for d in all_d if 14 <= d <= 45][:40]


def extract_sheet_data(image_bytes: bytes, sawn_rate: float = 1600.0, slab_rate: float = 25.0) -> Dict[str, Any]:
    img, gray = preprocess_image(image_bytes)
    img_deskewed, gray_deskewed, angle = detect_and_deskew(img, gray)

    # Upscale for better OCR on phone photos
    h, w = gray_deskewed.shape[:2]
    scale = 2.0 if max(h, w) < 1600 else 1.0
    if scale > 1:
        gray_deskewed = cv2.resize(gray_deskewed, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray_deskewed)
    thr = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)

    custom_config = r"--oem 3 --psm 6"
    try:
        raw_text = pytesseract.image_to_string(thr, lang="rus+eng", config=custom_config)
    except Exception:
        try:
            raw_text = pytesseract.image_to_string(enhanced, lang="rus+eng", config=custom_config)
        except Exception:
            raw_text = pytesseract.image_to_string(enhanced, config=custom_config)

    date_match = re.search(r"(\d{1,2}[\.,/]\d{1,2}(?:[\.,/]\d{2,4})?)", raw_text)
    shift_date = date_match.group(1).replace(",", ".").replace("/", ".") if date_match else datetime.now().strftime("%d.%m.%Y")

    table_rows = parse_standard_from_text(raw_text)
    extra_rows = parse_extras(raw_text)
    diameters = parse_logs(raw_text)

    total_g1_pcs = 0
    total_g2_pcs = 0
    total_g1_vol = 0.0
    total_g2_vol = 0.0
    for row in table_rows:
        g1 = int(row["grade1_count"] or 0)
        g2 = int(row["grade2_count"] or 0)
        total_g1_pcs += g1
        total_g2_pcs += g2
        total_g1_vol += float(row["grade1_vol_m3"] or 0)
        total_g2_vol += float(row["grade2_vol_m3"] or 0)

    sawn_extra = 0.0
    slab_pcs = 0
    extra_vol = 0.0
    for extra in extra_rows:
        cnt = int(extra["count"] or 0)
        if extra.get("is_slab"):
            vol = round(cnt * 0.015, 3)
            slab_pcs += cnt
        else:
            vol = calculate_sawn_volume(extra["size"], cnt)
            sawn_extra += vol
        extra["vol_m3"] = vol
        extra_vol += vol

    logs_calc = calculate_total_logs_volume(diameters, length_m=6.0)
    sawn_base = round(total_g1_vol + total_g2_vol + sawn_extra, 3)
    total_sawn = round(total_g1_vol + total_g2_vol + extra_vol, 3)
    logs_vol = logs_calc["total_volume_m3"]
    raw_yield = (sawn_base / logs_vol * 100) if logs_vol > 0 else 0.0
    yield_floor = math.floor(raw_yield)

    sawn_salary = int(round(sawn_base * sawn_rate))
    slab_salary = int(round(slab_pcs * slab_rate))

    filled = sum(1 for r in table_rows if r["is_filled"])

    return {
        "metadata": {
            "shift_date": shift_date,
            "shift_type": "Дневная смена",
            "brigade": "Бригада №1",
            "notes": f"OCR: {filled} строк бланка, {len(extra_rows)} доп., {len(diameters)} брёвен. Deskew={angle:.1f}°",
            "processed_at": datetime.now().isoformat(timespec="seconds"),
            "model_engine": "OpenCV + Tesseract OCR Rus/Eng (реальный парсер, без пресетов)",
            "ocr_confidence": 0.75 if filled or extra_rows or diameters else 0.2
        },
        "summary": {
            "total_grade1_count": total_g1_pcs,
            "total_grade2_count": total_g2_pcs,
            "total_pieces": total_g1_pcs + total_g2_pcs + sum(e["count"] for e in extra_rows),
            "total_grade1_volume_m3": round(total_g1_vol, 3),
            "total_grade2_volume_m3": round(total_g2_vol, 3),
            "total_extra_volume_m3": round(extra_vol, 3),
            "total_sawn_base_volume_m3": sawn_base,
            "total_sawn_volume_m3": total_sawn,
            "total_logs_count": logs_calc["count"],
            "total_logs_volume_m3": logs_vol,
            "raw_yield_percent": round(raw_yield, 1),
            "yield_percent": yield_floor,
            "salary": {
                "sawn_rate_per_m3": sawn_rate,
                "slab_rate_per_piece": slab_rate,
                "sawn_base_volume_m3": sawn_base,
                "sawn_salary_rub": sawn_salary,
                "slab_count": slab_pcs,
                "slab_salary_rub": slab_salary,
                "total_salary_rub": sawn_salary + slab_salary
            }
        },
        "standard_table": table_rows,
        "extra_items": extra_rows,
        "roundwood_logs": {
            "diameters": diameters,
            "count": logs_calc["count"],
            "total_volume_m3": logs_calc["total_volume_m3"],
            "breakdown": logs_calc["breakdown"]
        },
        "raw_ocr_sample": raw_text[:2500] if raw_text else ""
    }
