import { useRef, useState } from "react";
import { Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import type { FeedComment, FeedPost, PostInput } from "../../shared/travel";
import { postSchema } from "../../shared/travel";
import { request } from "../services/httpClient";
import { useAuth } from "./auth";
import { usePagedResource } from "./usePagedResource";
import Dialog from "../components/ui/Dialog";
import { currentProvinceName, PROVINCES_34 } from "../../shared/provinces";
import { CommunityExamples } from "./TravelExamples";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu.";
const date = (value: string) => new Date(value).toLocaleString("vi-VN");
export function CommunityFeed({ onSignIn }: { onSignIn: () => void }) {
  const { user } = useAuth(),
    feed = usePagedResource<FeedPost>("/v1/posts");
  const [editor, setEditor] = useState<(PostInput & { id?: string }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null);
  const likeLocks = useRef(new Set<string>()),
    [pending, setPending] = useState<string[]>([]);
  const like = async (post: FeedPost) => {
    if (!user) {
      onSignIn();
      return;
    }
    if (likeLocks.current.has(post.id)) return;
    likeLocks.current.add(post.id);
    setPending([...likeLocks.current]);
    setError("");
    const liked = !post.liked;
    feed.setItems((items) =>
      items.map((item) =>
        item.id === post.id
          ? { ...item, liked, likeCount: item.likeCount + (liked ? 1 : -1) }
          : item,
      ),
    );
    try {
      const result = await request<{ liked: boolean; likeCount: number }>(
        `/v1/posts/${post.id}/like`,
        { method: "PUT", body: { liked } },
      );
      feed.setItems((items) =>
        items.map((item) =>
          item.id === post.id ? { ...item, ...result } : item,
        ),
      );
    } catch (failure) {
      feed.setItems((items) =>
        items.map((item) =>
          item.id === post.id
            ? { ...item, liked: post.liked, likeCount: post.likeCount }
            : item,
        ),
      );
      setError(message(failure));
    } finally {
      likeLocks.current.delete(post.id);
      setPending([...likeLocks.current]);
    }
  };
  return (
    <section className="page-shell max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Chuyện trên đường</h1>
          <p className="page-lead">Chia sẻ trải nghiệm du lịch Việt Nam.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() =>
            user
              ? setEditor({ content: "", province: "", imageUrl: "" })
              : onSignIn()
          }
        >
          Viết bài
        </button>
      </div>
      <CommunityExamples />
      <h2 className="mb-4 text-xl font-semibold">Bài đăng của cộng đồng</h2>
      {(error || feed.error) && (
        <p role="alert" className="my-4 text-red-700">
          {error || feed.error}{" "}
          <button className="subtle-link" onClick={() => void feed.reload()}>
            Tải lại
          </button>
        </p>
      )}
      <div className="space-y-5">
        {feed.items.map((post) => (
          <article key={post.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{post.author.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {date(post.createdAt)}{" "}
                  {post.province && `· ${currentProvinceName(post.province)}`}
                </p>
              </div>
              {user?.id === post.author.id && (
                <div className="flex gap-2">
                  <button
                    className="icon-button"
                    aria-label="Sửa bài viết"
                    onClick={() =>
                      setEditor({
                        id: post.id,
                        content: post.content,
                        province: currentProvinceName(post.province),
                        imageUrl: post.imageUrl,
                      })
                    }
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Xóa bài viết"
                    onClick={() => setDeleting(post.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <p className="prose-travel my-4">{post.content}</p>
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={`Ảnh du lịch ${post.province}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="mb-4 max-h-96 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex gap-5 border-t border-slate-100 pt-4">
              <button
                className={`inline-flex items-center gap-2 ${post.liked ? "text-accent" : "text-muted"}`}
                aria-pressed={post.liked}
                disabled={pending.includes(post.id)}
                onClick={() => void like(post)}
              >
                <Heart size={18} fill={post.liked ? "currentColor" : "none"} />
                {post.likeCount} Thích
              </button>
              <span className="inline-flex items-center gap-2 text-muted">
                <MessageCircle size={18} />
                {post.commentCount} bình luận
              </span>
            </div>
            <Comments
              postId={post.id}
              onSignIn={onSignIn}
              onCount={(delta) =>
                feed.setItems((items) =>
                  items.map((p) =>
                    p.id === post.id
                      ? {
                          ...p,
                          commentCount: Math.max(0, p.commentCount + delta),
                        }
                      : p,
                  ),
                )
              }
            />
          </article>
        ))}
      </div>
      {feed.loading && (
        <p role="status" className="p-5">
          Đang tải bài viết…
        </p>
      )}
      {!feed.loading && !feed.error && !feed.items.length && (
        <p className="empty-state">
          Chưa có bài viết. Hãy chia sẻ chuyến đi đầu tiên!
        </p>
      )}
      {feed.hasMore && (
        <button
          className="btn-secondary mt-5"
          disabled={feed.loading}
          onClick={() => void feed.more()}
        >
          Xem thêm
        </button>
      )}
      {editor && (
        <Dialog
          title={editor.id ? "Chỉnh sửa bài viết" : "Chia sẻ chuyến đi"}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const { id, ...input } = editor,
                parsed = postSchema.safeParse(input);
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
              setBusy(true);
              setError("");
              try {
                await request(`/v1/posts${id ? `/${id}` : ""}`, {
                  method: id ? "PATCH" : "POST",
                  body: parsed.data,
                });
                setEditor(null);
                await feed.reload();
              } catch (failure) {
                setError(message(failure));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              Nội dung
              <textarea
                className="field mt-1"
                rows={6}
                required
                maxLength={5000}
                value={editor.content}
                onChange={(e) =>
                  setEditor({ ...editor, content: e.target.value })
                }
              />
            </label>
            <label className="field-label">
              Tỉnh / thành
              <input
                className="field mt-1"
                maxLength={100}
                list="community-provinces-34"
                value={editor.province}
                onChange={(e) =>
                  setEditor({ ...editor, province: e.target.value })
                }
              />
            </label>
            <datalist id="community-provinces-34">
              {PROVINCES_34.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <label className="field-label">
              Liên kết ảnh HTTPS (tùy chọn)
              <input
                className="field mt-1"
                type="url"
                maxLength={2048}
                value={editor.imageUrl}
                onChange={(e) =>
                  setEditor({ ...editor, imageUrl: e.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button className="btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Đăng bài"}
            </button>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Xóa bài viết và bình luận?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="mt-5 flex gap-3">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Giữ lại
            </button>
            <button
              className="btn-primary !bg-accent"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await request(`/v1/posts/${deleting}`, { method: "DELETE" });
                  feed.setItems((items) =>
                    items.filter((p) => p.id !== deleting),
                  );
                  setDeleting(null);
                } catch (failure) {
                  setError(message(failure));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Xóa
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-red-700">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </section>
  );
}
function Comments({
  postId,
  onSignIn,
  onCount,
}: {
  postId: string;
  onSignIn: () => void;
  onCount: (delta: number) => void;
}) {
  const { user } = useAuth(),
    [open, setOpen] = useState(false),
    [content, setContent] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const comments = usePagedResource<FeedComment>(
    open ? `/v1/posts/${postId}/comments` : null,
  );
  return (
    <div className="mt-4">
      <button
        className="subtle-link"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ẩn bình luận" : "Xem bình luận"}
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          {comments.items.map((comment) => (
            <div key={comment.id} className="rounded-xl bg-paper p-3">
              <p className="text-sm font-semibold">
                {comment.author.name}{" "}
                <span className="text-xs font-normal text-muted">
                  {date(comment.createdAt)}
                </span>
              </p>
              <p className="prose-travel text-sm">{comment.content}</p>
              {user?.id === comment.author.id && (
                <div className="mt-2 flex gap-4 text-xs">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(comment.id);
                      setContent(comment.content);
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await request(`/v1/comments/${comment.id}`, {
                          method: "DELETE",
                        });
                        comments.setItems((items) =>
                          items.filter((c) => c.id !== comment.id),
                        );
                        onCount(-1);
                        if (editing === comment.id) {
                          setEditing(null);
                          setContent("");
                        }
                      } catch (failure) {
                        setError(message(failure));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Xóa
                  </button>
                </div>
              )}
            </div>
          ))}
          {(error || comments.error) && (
            <p role="alert" className="text-sm text-red-700">
              {error || comments.error}{" "}
              <button onClick={() => void comments.reload()}>Thử lại</button>
            </p>
          )}
          {comments.loading && <p role="status">Đang tải bình luận…</p>}
          {comments.hasMore && (
            <button
              disabled={comments.loading}
              className="subtle-link"
              onClick={() => void comments.more()}
            >
              Bình luận trước
            </button>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!user) {
                onSignIn();
                return;
              }
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await request(
                  editing
                    ? `/v1/comments/${editing}`
                    : `/v1/posts/${postId}/comments`,
                  { method: editing ? "PATCH" : "POST", body: { content } },
                );
                if (!editing) onCount(1);
                setContent("");
                setEditing(null);
                await comments.reload();
              } catch (failure) {
                setError(message(failure));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              {editing ? "Sửa bình luận" : "Viết bình luận"}
              <textarea
                className="field mt-1"
                required
                maxLength={2000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : editing ? "Lưu" : "Gửi"}
            </button>
            {editing && (
              <button
                className="btn-secondary ml-2"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setContent("");
                }}
              >
                Hủy sửa
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
