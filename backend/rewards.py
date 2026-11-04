"""Award points within the same serializable transaction as the action."""

from .database import insert, one
from .domain import DAILY_CAPS, REWARDS, tier_for, vietnam_day


def award_points(conn, user_id, event, source):
    entry = insert(
        conn,
        "PointEntry",
        {
            "userId": user_id,
            "event": event,
            "source": source,
            "amount": 0,
        },
        'ON CONFLICT ("userId", event, source) DO NOTHING',
    )
    if not entry:
        return 0
    quota = one(
        conn,
        """INSERT INTO "RewardQuota" ("userId", event, day, count)
        VALUES (%s, %s, %s, 1) ON CONFLICT ("userId", event, day)
        DO UPDATE SET count = "RewardQuota".count + 1 RETURNING count""",
        (user_id, event, vietnam_day()),
    )
    amount = REWARDS[event] if quota["count"] <= DAILY_CAPS[event] else 0
    if amount:
        conn.execute('UPDATE "PointEntry" SET amount = %s WHERE id = %s', (amount, entry["id"]))
        user = one(
            conn,
            'UPDATE "User" SET points = points + %s WHERE id = %s RETURNING points',
            (amount, user_id),
        )
        conn.execute(
            'UPDATE "User" SET tier = %s WHERE id = %s', (tier_for(user["points"]), user_id)
        )
    return amount
