"""Validation and travel rules, matching the existing browser API contract."""

import json
import math
import re
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

CATALOG = json.loads(Path(__file__).with_name("catalog.json").read_text(encoding="utf-8"))
PROVINCES = CATALOG["provinces"]
PLACES = {p["location_id"]: p for p in CATALOG["places"]}
REWARDS = {"SIGNUP": 50, "REVIEW": 20, "ITINERARY": 30, "CHECKIN": 10}
DAILY_CAPS = {"SIGNUP": 1, "REVIEW": 5, "ITINERARY": 3, "CHECKIN": 5}


class HttpError(Exception):
    def __init__(self, status, message, fields=None):
        super().__init__(message)
        self.status = status
        self.fields = fields


def invalid(field, message="Dữ liệu không hợp lệ."):
    raise HttpError(422, message, {field: [message]})


def normalize_province(value):
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if not "\u0300" <= c <= "\u036f")
    value = value.lower().replace("đ", "d")
    value = re.sub(r"[.–—-]", " ", value)
    return re.sub(r"^(?:tinh|thanh pho|tp)\s+", "", " ".join(value.split()))


_by_name = {
    normalize_province(name): p["name"]
    for p in PROVINCES
    for name in [p["name"], *(old["name"] for old in p["previous"])]
}
_by_id = {old["id"]: p["id"] for p in PROVINCES for old in p["previous"]}


def current_province_name(name):
    return _by_name.get(normalize_province(name), name)


def current_province_id(value):
    return _by_id.get(value, value)


def tier_for(points):
    for threshold, key in [(1000, "DIAMOND"), (500, "GOLD"), (200, "SILVER")]:
        if points >= threshold:
            return key
    return "BRONZE"


def vietnam_day(date=None):
    return ((date or datetime.now(UTC)) + timedelta(hours=7)).date().isoformat()


def distance_meters(a, b, c, d):
    h = (
        math.sin(math.radians(c - a) / 2) ** 2
        + math.cos(math.radians(a))
        * math.cos(math.radians(c))
        * math.sin(math.radians(d - b) / 2) ** 2
    )
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(max(0, 1 - h)))


def uuid(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}", value
    ):
        invalid("id", "Mã định danh không hợp lệ.")
    return str(UUID(value))


def positive_int(value, field="id"):
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        value = int(value)
    if type(value) is not int or not 0 < value <= 2147483647:
        invalid(field)
    return value


def strict(body, required, optional=()):
    if not isinstance(body, dict):
        invalid("body", "Yêu cầu cần có đối tượng JSON.")
    for field in set(required) - body.keys():
        invalid(field, "Thiếu trường bắt buộc.")
    for field in body.keys() - set(required) - set(optional):
        invalid(field, "Trường dữ liệu không được cho phép.")


def string(body, field, minimum, maximum, trim=True):
    value = body.get(field)
    if not isinstance(value, str):
        invalid(field)
    if trim:
        value = value.strip()
    # JavaScript/Zod counts UTF-16 code units; preserve that validation boundary.
    length = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
    if not minimum <= length <= maximum:
        invalid(field, f"{field} cần từ {minimum} đến {maximum} ký tự.")
    return value


def number(body, field, minimum, maximum, integer=False):
    value = body.get(field)
    if type(value) not in (int, float) or not math.isfinite(value):
        invalid(field)
    if not minimum <= value <= maximum or (integer and int(value) != value):
        invalid(field)
    return int(value) if integer else value


def choice(body, field, values):
    value = body.get(field)
    if value not in values:
        invalid(field)
    return value


def image_url(body):
    value = string(body, "imageUrl", 0, 2048, trim=False)
    if value:
        try:
            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise ValueError()
            if any(c.isspace() for c in value):
                raise ValueError()
        except ValueError:
            invalid("imageUrl", "Ảnh cần liên kết HTTPS.")
    return value


def credentials(body, signup=False):
    strict(body, ["email", "password", *(["name"] if signup else [])])
    email = string(body, "email", 3, 254).lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", email):
        invalid("email", "Email không hợp lệ.")
    password = string(body, "password", 12 if signup else 1, 72, trim=False)
    try:
        if len(password.encode("utf-8")) > 72:
            invalid("password", "Mật khẩu vượt quá 72 byte UTF-8.")
    except UnicodeEncodeError:
        invalid("password", "Mật khẩu không hợp lệ.")
    result = {"email": email, "password": password}
    if signup:
        result["name"] = string(body, "name", 2, 80)
    return result


def post_input(body):
    strict(body, ["content", "province"], ["imageUrl"])
    return {
        "content": string(body, "content", 1, 5000),
        "province": current_province_name(string(body, "province", 0, 100)),
        "imageUrl": image_url({"imageUrl": body.get("imageUrl", "")}),
    }


def comment_input(body):
    strict(body, ["content"])
    return {"content": string(body, "content", 1, 2000)}


def review_input(body):
    strict(body, ["rating", "content"])
    return {
        "rating": number(body, "rating", 1, 5, integer=True),
        "content": string(body, "content", 20, 3000),
    }


def checkin_input(body):
    strict(body, ["latitude", "longitude", "accuracy", "timestamp"])
    return {
        "latitude": number(body, "latitude", -90, 90),
        "longitude": number(body, "longitude", -180, 180),
        "accuracy": number(body, "accuracy", 0, 200),
        "timestamp": number(body, "timestamp", 1, 9007199254740991, integer=True),
    }


def itinerary_input(body, create=False):
    required = [
        "title",
        "description",
        "province",
        "visibility",
        "days",
        "id" if create else "version",
    ]
    strict(body, required)
    result = {
        "title": string(body, "title", 3, 140),
        "description": string(body, "description", 0, 5000),
        "province": current_province_name(string(body, "province", 1, 100)),
        "visibility": choice(body, "visibility", ("PRIVATE", "PUBLIC")),
    }
    if create:
        result["id"] = uuid(body["id"])
    else:
        result["version"] = number(body, "version", 1, 2147483647, integer=True)
    if not isinstance(body["days"], list) or not 1 <= len(body["days"]) <= 30:
        invalid("days")
    days = []
    for day in body["days"]:
        strict(day, ["title", "activities"])
        title = string(day, "title", 1, 120)
        if not isinstance(day["activities"], list) or not 1 <= len(day["activities"]) <= 20:
            invalid("days", "Mỗi ngày cần từ 1 đến 20 hoạt động.")
        activities = []
        for activity in day["activities"]:
            strict(activity, ["time", "endTime", "title", "place", "notes", "cost"])
            item = {key: string(activity, key, 5, 5, trim=False) for key in ("time", "endTime")}
            if any(not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", item[k]) for k in item):
                invalid("days", "Giờ cần có dạng HH:mm.")
            if item["endTime"] <= item["time"]:
                invalid("days", "Giờ kết thúc phải sau giờ bắt đầu.")
            item.update(
                {
                    "title": string(activity, "title", 2, 160),
                    "place": string(activity, "place", 0, 160),
                    "notes": string(activity, "notes", 0, 2000),
                    "cost": number(activity, "cost", 0, 1000000000, integer=True),
                }
            )
            activities.append(item)
        activities.sort(key=lambda a: a["time"])
        if any(a["time"] < b["endTime"] for b, a in zip(activities, activities[1:])):
            invalid("days", "Các hoạt động trong ngày không được trùng giờ.")
        days.append({"title": title, "activities": activities})
    return {**result, "days": days}


def place_input(body, update=False):
    strict(
        body,
        [
            "provinceId",
            "name",
            "category",
            "season",
            "address",
            "lat",
            "lng",
            "description",
            "article",
            "imageUrl",
            *(["version"] if update else []),
        ],
    )
    result = {
        "provinceId": number(body, "provinceId", 1, 63, integer=True),
        "name": string(body, "name", 2, 160),
        "category": choice(
            body, "category", ("Landmark", "History", "Geography", "Food", "Festival")
        ),
        "season": choice(body, "season", ("Spring", "Summer", "Autumn", "Winter", "AllYear")),
        "address": string(body, "address", 3, 500),
        "lat": number(body, "lat", -90, 90),
        "lng": number(body, "lng", -180, 180),
        "description": string(body, "description", 20, 3000),
        "article": string(body, "article", 0, 20000),
        "imageUrl": image_url(body),
    }
    if result["provinceId"] not in {p["id"] for p in PROVINCES}:
        invalid("provinceId", "Chọn tỉnh/thành hợp lệ.")
    if update:
        result["version"] = number(body, "version", 1, 2147483647, integer=True)
    return result


def managed_place(place):
    original = PLACES.get(place["id"])
    result = dict(place)
    if not place["description"] and original:
        for key in ("category", "season", "address", "description"):
            result[key] = original[key]
    result["article"] = place["article"] or (
        original.get("article", "") if original and place["version"] == 1 else ""
    )
    return result
