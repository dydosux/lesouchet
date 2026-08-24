import math
from typing import List, Dict, Optional, Tuple

# ГОСТ 2708-75: Объемы круглых лесоматериалов (длина 6.0 м)
# Ключ: диаметр в вершине (см) -> объем (м3) для длины 6.0 м
GOST_2708_75_L6 = {
    10: 0.058, 11: 0.071, 12: 0.086, 13: 0.103, 14: 0.123,
    15: 0.142, 16: 0.164, 17: 0.188, 18: 0.214, 19: 0.242,
    20: 0.270, 21: 0.300, 22: 0.330, 23: 0.365, 24: 0.400,
    25: 0.440, 26: 0.480, 27: 0.520, 28: 0.560, 29: 0.610,
    30: 0.660, 31: 0.710, 32: 0.760, 33: 0.815, 34: 0.870,
    35: 0.930, 36: 0.990, 37: 1.050, 38: 1.110, 39: 1.180,
    40: 1.250, 42: 1.390, 44: 1.540, 46: 1.690, 48: 1.850,
    50: 2.020
}

def parse_dimensions(size_str: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Parses a dimension string like '30X100X6', '50x150x4', '75x250' into (thickness_mm, width_mm, length_m).
    """
    if not size_str:
        return None, None, None
    clean = size_str.lower().replace('*', 'x').replace('х', 'x').replace('×', 'x').replace(' ', '')
    parts = clean.split('x')
    try:
        if len(parts) >= 3:
            t = float(parts[0])
            w = float(parts[1])
            l = float(parts[2])
            return t, w, l
        elif len(parts) == 2:
            t = float(parts[0])
            w = float(parts[1])
            return t, w, 6.0
    except ValueError:
        pass
    return None, None, None

def calculate_sawn_volume(size_str: str, count: int) -> float:
    """
    Calculates volume in cubic meters (m³) for sawn timber.
    thickness (mm) * width (mm) * length (m) * count / 1,000,000
    """
    if count <= 0:
        return 0.0
    t, w, l = parse_dimensions(size_str)
    if t is not None and w is not None and l is not None:
        vol_per_piece = (t / 1000.0) * (w / 1000.0) * l
        return round(vol_per_piece * count, 4)
    return 0.0

def calculate_log_volume(diameter_cm: int, length_m: float = 6.0) -> float:
    """
    Calculates log volume using GOST 2708-75.
    """
    if length_m == 6.0 and diameter_cm in GOST_2708_75_L6:
        return GOST_2708_75_L6[diameter_cm]
    
    radius_m = (diameter_cm + (length_m / 2.0) * 1.0) / 200.0
    vol = math.pi * (radius_m ** 2) * length_m
    return round(vol, 3)

def calculate_total_logs_volume(diameters: List[int], length_m: float = 6.0) -> Dict:
    total_vol = 0.0
    breakdown = []
    for d in diameters:
        v = calculate_log_volume(d, length_m)
        total_vol += v
        breakdown.append({"diameter": d, "volume_m3": round(v, 3)})
    
    return {
        "count": len(diameters),
        "total_volume_m3": round(total_vol, 3),
        "breakdown": breakdown
    }
