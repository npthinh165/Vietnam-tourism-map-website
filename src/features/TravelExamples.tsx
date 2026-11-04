import { ITINERARY_EXAMPLES, COMMUNITY_EXAMPLES } from "../data/travelExamples";
import type { ItineraryInput } from "../../shared/travel";
const money = (n: number) => n.toLocaleString("vi-VN") + " ₫";
export function ItineraryExamples({
  onCopy,
}: {
  onCopy: (input: ItineraryInput) => void;
}) {
  return (
    <section
      className="my-6 rounded-2xl border border-teal-100 bg-teal-50/40 p-4 sm:p-6"
      aria-label="Lịch trình mẫu"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
        Cảm hứng cho chuyến đi
      </p>
      <h2 className="mt-2 text-xl font-semibold">
        Bắt đầu từ một lịch trình mẫu
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Xem trước mà không cần đăng nhập. Sao chép để chỉnh sửa thành hành trình
        riêng; giờ và chi phí chỉ mang tính minh họa.
      </p>
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-3">
        {ITINERARY_EXAMPLES.map((example) => (
          <article
            key={example.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <img
              src={example.image}
              alt=""
              className="h-36 w-full object-cover"
              loading="lazy"
            />
            <div className="p-4">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                Lịch trình mẫu
              </span>
              <h3 className="mt-3 font-semibold">{example.input.title}</h3>
              <p className="mt-2 text-xs text-muted">
                {example.input.province} · {example.input.days.length} ngày
              </p>
              <p className="mt-2 text-sm text-teal-800">
                Dự trù mẫu:{" "}
                {money(
                  example.input.days.reduce(
                    (n, d) => n + d.activities.reduce((v, a) => v + a.cost, 0),
                    0,
                  ),
                )}
              </p>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-teal-700">
                  Xem chi tiết lịch trình
                </summary>
                <p className="mt-3 leading-6 text-muted">
                  {example.input.description}
                </p>
                {example.input.days.map((day, i) => (
                  <div key={day.title} className="mt-4">
                    <h4 className="font-semibold">
                      Ngày {i + 1}: {day.title}
                    </h4>
                    <ol className="mt-3 space-y-3">
                      {day.activities.map((a) => (
                        <li
                          key={a.time}
                          className="border-l-2 border-teal-200 pl-3"
                        >
                          <p className="text-xs text-teal-700">
                            {a.time} – {a.endTime}
                          </p>
                          <p className="mt-1 font-medium">{a.title}</p>
                          <p className="mt-1 text-xs text-muted">
                            {a.place} · {money(a.cost)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            {a.notes}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </details>
              <button
                className="btn-secondary mt-4 w-full"
                onClick={() => onCopy(example.input)}
              >
                Dùng lịch trình này
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function CommunityExamples() {
  return (
    <section className="mb-8 space-y-4" aria-label="Bài viết cộng đồng mẫu">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
          Góc cảm hứng
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Những câu chuyện để bắt đầu
        </h2>
        <p className="mt-2 text-sm text-muted">
          Bài minh họa cho cách chia sẻ trải nghiệm, không phải bài đăng hay
          đánh giá của thành viên.
        </p>
      </div>
      {COMMUNITY_EXAMPLES.map((post) => (
        <article
          key={post.id}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid sm:grid-cols-[180px_1fr]"
        >
          <img
            src={post.image}
            alt=""
            loading="lazy"
            className="h-40 w-full object-cover sm:h-full"
          />
          <div className="p-5">
            <span className="text-xs font-medium text-amber-700">
              Bài viết mẫu · {post.province}
            </span>
            <h3 className="mt-2 text-lg font-semibold">{post.title}</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
              {post.content}
            </p>
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm italic text-teal-800">
              {post.prompt}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
