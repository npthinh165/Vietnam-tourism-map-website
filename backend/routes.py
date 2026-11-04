"""Authentication, community, itineraries, destinations and admin endpoints."""

import secrets
import time
from datetime import UTC, datetime, timedelta
from functools import wraps

import bcrypt
from flask import g, jsonify, request

from .database import all_rows, insert, one, update
from .domain import (
    HttpError,
    checkin_input,
    comment_input,
    current_province_id,
    distance_meters,
    itinerary_input,
    managed_place,
    place_input,
    positive_int,
    post_input,
    review_input,
    strict,
    string,
    uuid,
    vietnam_day,
)
from .rewards import award_points
from .security import (
    csrf_for,
    digest,
    json_value,
    member,
    paginated,
    require_csrf,
    require_user,
    session_user,
)

LIFETIME = 7 * 24 * 3600


def register_routes(app, db):
    dummy_hash = bcrypt.hashpw(secrets.token_hex(32).encode(), bcrypt.gensalt(rounds=12))

    def route(path, methods=("GET",)):
        def decorate(handler):
            @wraps(handler)
            def dispatch(**kwargs):
                result = db.run(lambda conn: handler(conn, **kwargs))
                if isinstance(result, tuple):
                    body, status = result
                    return (jsonify(json_value(body)), status) if status != 204 else ("", 204)
                if isinstance(result, (dict, list)):
                    return jsonify(json_value(result))
                return result

            app.route(path, methods=methods)(dispatch)
            return dispatch

        return decorate

    def auth_response(user, token, status=200):
        response = jsonify(json_value({"user": session_user(user), "csrfToken": csrf_for(token)}))
        response.status_code = status
        response.set_cookie(
            app.config["COOKIE_NAME"],
            token,
            max_age=LIFETIME,
            httponly=True,
            secure=app.config["PRODUCTION"],
            samesite="Lax",
            path="/",
        )
        return response

    def author(conn, identifier):
        return member(one(conn, 'SELECT * FROM "User" WHERE id = %s', (identifier,)))

    def plan_details(conn, plan):
        plan["author"] = author(conn, plan["authorId"])
        plan["days"] = all_rows(
            conn,
            'SELECT * FROM "ItineraryDay" WHERE "itineraryId" = %s ORDER BY day',
            (plan["id"],),
        )
        for day in plan["days"]:
            day["activities"] = all_rows(
                conn, 'SELECT * FROM "Activity" WHERE "dayId" = %s ORDER BY position', (day["id"],)
            )
        return plan

    def create_days(conn, plan_id, days):
        for number, day in enumerate(days, 1):
            row = insert(
                conn, "ItineraryDay", {"itineraryId": plan_id, "day": number, "title": day["title"]}
            )
            for position, activity in enumerate(day["activities"]):
                insert(conn, "Activity", {"dayId": row["id"], "position": position, **activity})

    @route("/api/auth/session")
    def session(conn):
        return {"user": g.user, "csrfToken": csrf_for(g.token) if g.user else None}

    @route("/api/auth/signup", ("POST",))
    def signup(conn):
        data = g.credentials
        user = insert(
            conn,
            "User",
            {
                "email": data["email"],
                "name": data["name"],
                "passwordHash": bcrypt.hashpw(
                    data["password"].encode(), bcrypt.gensalt(12)
                ).decode(),
            },
        )
        award_points(conn, user["id"], "SIGNUP", str(user["id"]))
        token = secrets.token_hex(32)
        insert(
            conn,
            "Session",
            {
                "tokenHash": digest(token),
                "userId": user["id"],
                "expiresAt": datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=LIFETIME),
            },
        )
        if g.token:
            conn.execute('DELETE FROM "Session" WHERE "tokenHash" = %s', (digest(g.token),))
        return auth_response(
            one(conn, 'SELECT * FROM "User" WHERE id = %s', (user["id"],)), token, 201
        )

    @route("/api/auth/signin", ("POST",))
    def signin(conn):
        data = g.credentials
        user = one(conn, 'SELECT * FROM "User" WHERE email = %s', (data["email"],))
        hashed = user["passwordHash"].encode() if user else dummy_hash
        if not bcrypt.checkpw(data["password"].encode(), hashed) or not user:
            raise HttpError(401, "Email hoặc mật khẩu không đúng.")
        if request.path == "/api/auth/admin/signin" and user["role"] != "ADMIN":
            raise HttpError(
                403, "Tài khoản không có quyền quản trị. Vui lòng đăng nhập dành cho thành viên."
            )
        if g.token:
            conn.execute('DELETE FROM "Session" WHERE "tokenHash" = %s', (digest(g.token),))
        conn.execute(
            'DELETE FROM "Session" WHERE "userId" = %s AND "expiresAt" <= CURRENT_TIMESTAMP',
            (user["id"],),
        )
        conn.execute(
            """DELETE FROM "Session" WHERE "tokenHash" IN (
            SELECT "tokenHash" FROM "Session" WHERE "userId" = %s
            ORDER BY "createdAt" DESC, "tokenHash" DESC OFFSET 4)""",
            (user["id"],),
        )
        token = secrets.token_hex(32)
        insert(
            conn,
            "Session",
            {
                "tokenHash": digest(token),
                "userId": user["id"],
                "expiresAt": datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=LIFETIME),
            },
        )
        return auth_response(user, token)

    app.add_url_rule("/api/auth/admin/signin", "admin_signin", signin, methods=["POST"])

    @route("/api/auth/signout", ("POST",))
    def signout(conn):
        if g.user:
            require_csrf()
            conn.execute('DELETE FROM "Session" WHERE "tokenHash" = %s', (digest(g.token),))
        response = app.response_class(status=204)
        response.delete_cookie(
            app.config["COOKIE_NAME"],
            path="/",
            httponly=True,
            secure=app.config["PRODUCTION"],
            samesite="Lax",
        )
        return response

    @route("/api/v1/profile", ("PATCH",))
    def profile(conn):
        strict(g.body, ["name"])
        return member(
            update(
                conn,
                "User",
                {"name": string(g.body, "name", 2, 80)},
                "id = %s",
                (require_user()["id"],),
            )
        )

    @route("/api/v1/rewards")
    def rewards(conn):
        user = require_user()
        return {**paginated(conn, "PointEntry", '"userId" = %s', (user["id"],)), "user": user}

    @route("/api/v1/posts", ("GET", "POST"))
    def posts(conn):
        if request.method == "POST":
            return insert(
                conn, "Post", {**post_input(g.body), "authorId": require_user()["id"]}
            ), 201
        result = paginated(conn, "Post")
        for post in result["items"]:
            post["author"] = author(conn, post["authorId"])
            post["imageUrl"] = post["imageUrl"] or ""
            post["liked"] = bool(
                g.user
                and one(
                    conn,
                    'SELECT 1 FROM "Like" WHERE "postId" = %s AND "userId" = %s',
                    (post["id"], g.user["id"]),
                )
            )
            post["likeCount"] = one(
                conn, 'SELECT count(*) AS count FROM "Like" WHERE "postId" = %s', (post["id"],)
            )["count"]
            post["commentCount"] = one(
                conn, 'SELECT count(*) AS count FROM "Comment" WHERE "postId" = %s', (post["id"],)
            )["count"]
        return result

    @route("/api/v1/posts/<identifier>", ("PATCH", "DELETE"))
    def change_post(conn, identifier):
        where, params = 'id = %s AND "authorId" = %s', (uuid(identifier), require_user()["id"])
        row = (
            update(conn, "Post", post_input(g.body), where, params)
            if request.method == "PATCH"
            else one(conn, f'DELETE FROM "Post" WHERE {where} RETURNING id', params)
        )
        if not row:
            raise HttpError(404, "Không tìm thấy bài viết của bạn.")
        return None, 204

    @route("/api/v1/posts/<identifier>/like", ("PUT",))
    def like(conn, identifier):
        post_id, user_id = uuid(identifier), require_user()["id"]
        strict(g.body, ["liked"])
        if type(g.body["liked"]) is not bool:
            raise HttpError(
                422, "Trạng thái thích không hợp lệ.", {"liked": ["Cần giá trị boolean."]}
            )
        if not one(conn, 'SELECT id FROM "Post" WHERE id = %s', (post_id,)):
            raise HttpError(404, "Bài viết đã bị xóa.")
        if g.body["liked"]:
            insert(conn, "Like", {"userId": user_id, "postId": post_id}, "ON CONFLICT DO NOTHING")
        else:
            conn.execute(
                'DELETE FROM "Like" WHERE "userId" = %s AND "postId" = %s', (user_id, post_id)
            )
        return {
            "liked": g.body["liked"],
            "likeCount": one(
                conn, 'SELECT count(*) AS count FROM "Like" WHERE "postId" = %s', (post_id,)
            )["count"],
        }

    @route("/api/v1/posts/<identifier>/comments", ("GET", "POST"))
    def comments(conn, identifier):
        post_id = uuid(identifier)
        if not one(conn, 'SELECT id FROM "Post" WHERE id = %s', (post_id,)):
            raise HttpError(404, "Bài viết đã bị xóa.")
        if request.method == "POST":
            comment = insert(
                conn,
                "Comment",
                {**comment_input(g.body), "postId": post_id, "authorId": require_user()["id"]},
            )
            comment["author"] = author(conn, comment["authorId"])
            return comment, 201
        result = paginated(conn, "Comment", '"postId" = %s', (post_id,))
        for comment in result["items"]:
            comment["author"] = author(conn, comment["authorId"])
        return result

    @route("/api/v1/comments/<identifier>", ("PATCH", "DELETE"))
    def change_comment(conn, identifier):
        where, params = 'id = %s AND "authorId" = %s', (uuid(identifier), require_user()["id"])
        row = (
            update(conn, "Comment", comment_input(g.body), where, params)
            if request.method == "PATCH"
            else one(conn, f'DELETE FROM "Comment" WHERE {where} RETURNING id', params)
        )
        if not row:
            raise HttpError(404, "Không tìm thấy bình luận của bạn.")
        return None, 204

    @route("/api/v1/itineraries", ("GET", "POST"))
    def itineraries(conn):
        if request.method == "GET":
            mine = request.args.get("mine") == "true"
            where = '"authorId" = %s' if mine else "visibility = 'PUBLIC'"
            result = paginated(conn, "Itinerary", where, (require_user()["id"],) if mine else ())
            result["items"] = [plan_details(conn, plan) for plan in result["items"]]
            return result
        data = itinerary_input(g.body, create=True)
        existing = one(conn, 'SELECT * FROM "Itinerary" WHERE id = %s', (data["id"],))
        user_id = require_user()["id"]
        if existing:
            if existing["authorId"] != user_id:
                raise HttpError(409, "Mã lịch trình đã được sử dụng.")
            return plan_details(conn, existing), 201
        days = data.pop("days")
        plan = insert(conn, "Itinerary", {**data, "authorId": user_id})
        create_days(conn, plan["id"], days)
        result = plan_details(conn, plan)
        award_points(conn, user_id, "ITINERARY", str(plan["id"]))
        return result, 201

    @route("/api/v1/itineraries/<identifier>", ("GET", "PUT", "DELETE"))
    def change_itinerary(conn, identifier):
        plan_id = uuid(identifier)
        if request.method == "GET":
            plan = one(
                conn,
                """SELECT * FROM "Itinerary" WHERE id = %s
                AND (visibility = 'PUBLIC' OR "authorId" = %s)""",
                (plan_id, g.user["id"] if g.user else None),
            )
            if not plan:
                raise HttpError(404, "Không tìm thấy lịch trình.")
            return plan_details(conn, plan)
        user_id = require_user()["id"]
        if request.method == "DELETE":
            version = positive_int(request.args.get("version"), "version")
            deleted = one(
                conn,
                'DELETE FROM "Itinerary" WHERE id = %s AND "authorId" = %s AND version = %s RETURNING id',
                (plan_id, user_id, version),
            )
            if not deleted:
                raise HttpError(409, "Lịch trình đã thay đổi hoặc không thuộc tài khoản này.")
            return None, 204
        data = itinerary_input(g.body)
        version, days = data.pop("version"), data.pop("days")
        plan = update(
            conn,
            "Itinerary",
            {**data, "version": version + 1},
            'id = %s AND "authorId" = %s AND version = %s',
            (plan_id, user_id, version),
        )
        if not plan:
            if not one(
                conn,
                'SELECT id FROM "Itinerary" WHERE id = %s AND "authorId" = %s',
                (plan_id, user_id),
            ):
                raise HttpError(404, "Không tìm thấy lịch trình của bạn.")
            raise HttpError(
                409, "Lịch trình đã thay đổi ở tab khác. Hãy tải lại bản mới trước khi sửa."
            )
        conn.execute('DELETE FROM "ItineraryDay" WHERE "itineraryId" = %s', (plan_id,))
        create_days(conn, plan_id, days)
        return plan_details(conn, plan)

    @route("/api/v1/places")
    def places(conn):
        return [
            managed_place(place) for place in all_rows(conn, 'SELECT * FROM "Place" ORDER BY id')
        ]

    @route("/api/v1/places/ratings")
    def ratings(conn):
        rows = all_rows(
            conn,
            'SELECT "placeId", avg(rating)::float AS average, count(*) AS count FROM "Review" GROUP BY "placeId"',
        )
        return {
            str(row["placeId"]): {"average": row["average"], "count": row["count"]} for row in rows
        }

    @route("/api/v1/places/<identifier>/reviews")
    def reviews(conn, identifier):
        result = paginated(conn, "Review", '"placeId" = %s', (positive_int(identifier),))
        for review in result["items"]:
            review["user"] = author(conn, review["userId"])
        return result

    @route("/api/v1/places/<identifier>/review", ("PUT",))
    def review(conn, identifier):
        data, place_id, user_id = (
            review_input(g.body),
            positive_int(identifier),
            require_user()["id"],
        )
        saved = insert(
            conn,
            "Review",
            {**data, "userId": user_id, "placeId": place_id},
            'ON CONFLICT ("userId", "placeId") DO UPDATE SET rating = EXCLUDED.rating, content = EXCLUDED.content, "updatedAt" = EXCLUDED."updatedAt"',
        )
        return {"review": saved, "awarded": award_points(conn, user_id, "REVIEW", str(place_id))}

    @route("/api/v1/checkins")
    def checkins(conn):
        rows = all_rows(
            conn,
            '''SELECT DISTINCT c."placeId", p."provinceId" FROM "CheckIn" c
            JOIN "Place" p ON p.id = c."placeId" WHERE c."userId" = %s ORDER BY c."placeId"''',
            (require_user()["id"],),
        )
        return {
            "places": [row["placeId"] for row in rows],
            "provinces": list(
                dict.fromkeys(current_province_id(row["provinceId"]) for row in rows)
            ),
        }

    @route("/api/v1/places/<identifier>/checkin", ("POST",))
    def checkin(conn, identifier):
        data, place_id, user_id = (
            checkin_input(g.body),
            positive_int(identifier),
            require_user()["id"],
        )
        if abs(time.time() * 1000 - data["timestamp"]) > 120000:
            raise HttpError(422, "Vị trí đã cũ. Hãy lấy lại vị trí hiện tại.")
        place = one(conn, 'SELECT * FROM "Place" WHERE id = %s', (place_id,))
        if not place:
            raise HttpError(404, "Không tìm thấy điểm đến.")
        if distance_meters(place["lat"], place["lng"], data["latitude"], data["longitude"]) > 1000:
            raise HttpError(422, "Bạn cần ở trong phạm vi 1 km của điểm đến để check-in.")
        day = vietnam_day()
        insert(
            conn,
            "CheckIn",
            {"userId": user_id, "placeId": place_id, "day": day},
            "ON CONFLICT DO NOTHING",
        )
        return {"awarded": award_points(conn, user_id, "CHECKIN", f"{place_id}:{day}")}

    @route("/api/admin/overview")
    def overview(conn):
        return {
            key: one(conn, f'SELECT count(*) AS count FROM "{table}"')["count"]
            for key, table in [
                ("users", "User"),
                ("posts", "Post"),
                ("reviews", "Review"),
                ("itineraries", "Itinerary"),
                ("places", "Place"),
            ]
        }

    @route("/api/admin/users")
    def users(conn):
        result = paginated(conn, "User")
        result["items"] = [
            {**session_user(user), "createdAt": user["createdAt"]} for user in result["items"]
        ]
        return result

    @route("/api/admin/places", ("GET", "POST"))
    def admin_places(conn):
        if request.method == "POST":
            return managed_place(insert(conn, "Place", place_input(g.body))), 201
        return [
            managed_place(place)
            for place in all_rows(conn, 'SELECT * FROM "Place" ORDER BY id DESC')
        ]

    @route("/api/admin/places/<identifier>", ("PUT",))
    def change_place(conn, identifier):
        data = place_input(g.body, update=True)
        version = data.pop("version")
        saved = update(
            conn,
            "Place",
            {**data, "version": version + 1},
            "id = %s AND version = %s",
            (positive_int(identifier), version),
        )
        if not saved:
            raise HttpError(
                409, "Địa điểm đã thay đổi hoặc không còn tồn tại. Hãy tải lại trước khi sửa."
            )
        return managed_place(saved)
