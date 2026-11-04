import type { ActivityInput, ItineraryInput } from "../../shared/travel";
import hero from "../assets/images/vietnam_travel_hero_1791335147966.jpg";
import food from "../assets/images/vietnam_culinary_food_1791335176027.jpg";
import danang from "../assets/images/danang_landmark_1791335159789.jpg";

const activity = (
  time: string,
  endTime: string,
  title: string,
  place: string,
  cost: number,
  notes: string,
): ActivityInput => ({ time, endTime, title, place, cost, notes });
export const ITINERARY_EXAMPLES: {
  id: string;
  image: string;
  input: ItineraryInput;
}[] = [
  {
    id: "hanoi",
    image: hero,
    input: {
      title: "Một ngày chậm rãi ở Hà Nội",
      province: "Hà Nội",
      visibility: "PRIVATE",
      description:
        "Lịch trình mẫu kết hợp không gian hồ, văn hóa và ẩm thực. Giờ và ngân sách là giả định để bạn luyện lập kế hoạch, không phải thông tin giá vé hay giờ mở cửa.",
      days: [
        {
          title: "Từ Hồ Gươm đến những câu chuyện phố",
          activities: [
            activity(
              "08:00",
              "09:30",
              "Dạo quanh hồ và chụp ảnh",
              "Hồ Hoàn Kiếm",
              0,
              "Bắt đầu nhẹ nhàng, dành thời gian quan sát nhịp sống quanh hồ.",
            ),
            activity(
              "10:00",
              "11:30",
              "Tìm hiểu văn hóa hiếu học",
              "Văn Miếu – Quốc Tử Giám",
              100000,
              "Khoản dự trù minh họa; kiểm tra thông tin tham quan trước chuyến đi.",
            ),
            activity(
              "12:00",
              "13:00",
              "Ăn trưa và nghỉ chân",
              "Khu vực trung tâm",
              100000,
              "Chọn món phù hợp sở thích và nhu cầu ăn uống của nhóm.",
            ),
            activity(
              "14:00",
              "16:00",
              "Khám phá phố và ghi nhật ký",
              "Khu phố cổ",
              100000,
              "Dành một khoảng nghỉ linh hoạt, ghi lại điều đáng nhớ trong ngày.",
            ),
          ],
        },
      ],
    },
  },
  {
    id: "danang-hoian",
    image: danang,
    input: {
      title: "Hai ngày Đà Nẵng – Hội An",
      province: "Đà Nẵng",
      visibility: "PRIVATE",
      description:
        "Ví dụ về cách chia một chuyến đi thành hai ngày với các khoảng di chuyển và nghỉ ngơi. Ngân sách chỉ minh họa, chưa gồm lưu trú và phương tiện đến điểm xuất phát.",
      days: [
        {
          title: "Nhịp sống bên sông Hàn",
          activities: [
            activity(
              "08:00",
              "10:00",
              "Khám phá cảnh quan",
              "Bán đảo Sơn Trà",
              150000,
              "Lựa chọn phương tiện và lộ trình thực tế trước khi xuất phát.",
            ),
            activity(
              "11:00",
              "12:30",
              "Trải nghiệm ẩm thực",
              "Trung tâm Đà Nẵng",
              120000,
              "Một bữa ăn và thời gian nghỉ; mức chi là giả định.",
            ),
            activity(
              "15:00",
              "17:00",
              "Dạo ven sông, ngắm những cây cầu",
              "Sông Hàn",
              50000,
              "Có thể thay đổi thời gian theo thời tiết và sức khỏe.",
            ),
          ],
        },
        {
          title: "Những câu chuyện phố Hội",
          activities: [
            activity(
              "08:00",
              "09:30",
              "Di chuyển đến Hội An",
              "Đà Nẵng – Hội An",
              200000,
              "Khung di chuyển dự kiến, cần điều chỉnh theo điểm xuất phát.",
            ),
            activity(
              "10:00",
              "12:00",
              "Khám phá không gian phố cổ",
              "Hội An",
              150000,
              "Tìm hiểu thông tin tham quan và các địa điểm muốn ghé trước chuyến đi.",
            ),
            activity(
              "12:00",
              "13:30",
              "Ăn trưa và nghỉ ngơi",
              "Hội An",
              120000,
              "Chọn một quán ăn phù hợp với cả nhóm.",
            ),
            activity(
              "14:00",
              "16:00",
              "Dạo phố và hoàn thành nhật ký",
              "Khu vực sông Hoài",
              50000,
              "Dành thời gian tự do, tránh xếp lịch quá sát giờ trở về.",
            ),
          ],
        },
      ],
    },
  },
  {
    id: "saigon",
    image: food,
    input: {
      title: "Một ngày khám phá Sài Gòn",
      province: "TP. Hồ Chí Minh",
      visibility: "PRIVATE",
      description:
        "Lịch trình mẫu thiên về nhịp sống đô thị, món ăn và thời gian tự do. Các khoản chi và thời gian là ví dụ, hãy chỉnh lại theo chuyến đi của bạn.",
      days: [
        {
          title: "Chợ, món ăn và câu chuyện thành phố",
          activities: [
            activity(
              "08:30",
              "10:00",
              "Tìm hiểu nhịp sống khu chợ",
              "Chợ Bến Thành",
              100000,
              "Quan sát các quầy hàng; trao đổi rõ giá trước khi mua.",
            ),
            activity(
              "10:30",
              "11:30",
              "Nghỉ chân và ghi lại cảm nhận",
              "Một quán cà phê trung tâm",
              70000,
              "Thời gian dự phòng để hành trình không quá gấp.",
            ),
            activity(
              "12:00",
              "13:00",
              "Bữa trưa với món địa phương",
              "Khu vực trung tâm",
              100000,
              "Dự trù minh họa cho một bữa ăn.",
            ),
            activity(
              "15:00",
              "17:00",
              "Tự do khám phá, chụp ảnh",
              "Trung tâm thành phố",
              50000,
              "Chọn điểm dừng phù hợp khoảng cách và thời tiết thực tế.",
            ),
          ],
        },
      ],
    },
  },
];
export const COMMUNITY_EXAMPLES = [
  {
    id: "slow-hanoi",
    image: hero,
    province: "Hà Nội",
    title: "Một buổi sáng không vội bên Hồ Gươm",
    content:
      "Bài viết minh họa: Một chuyến đi không nhất thiết phải ghé thật nhiều nơi. Trong câu chuyện này, hành trình bắt đầu bằng một vòng đi bộ, một khoảng nghỉ và vài dòng ghi chép về những điều nhỏ bé quanh hồ.\n\nĐiều muốn chia sẻ: hãy để lịch trình có khoảng trống. Một điểm dừng khiến bạn muốn ở lại lâu hơn cũng có thể trở thành kỷ niệm đáng nhớ nhất.",
    prompt: "Chuyến đi nào khiến bạn muốn sống chậm lại?",
  },
  {
    id: "danang-notes",
    image: danang,
    province: "Đà Nẵng",
    title: "Đi cùng bạn bè: mỗi người chọn một điểm dừng",
    content:
      "Bài viết minh họa: Nhóm bạn thử một cách lên kế hoạch đơn giản: mỗi người chọn một trải nghiệm yêu thích, rồi cùng sắp xếp thời gian di chuyển và nghỉ ngơi. Có người muốn ngắm cảnh, có người thích tìm hiểu món ăn, có người chỉ muốn đi dạo bên sông.\n\nCuối cùng, lịch trình không còn là danh sách phải hoàn thành, mà là một thỏa thuận để cả nhóm cùng vui. Những khoản chi được ghi riêng giúp mọi người dễ trao đổi hơn.",
    prompt: "Bạn thường phân chia việc lên kế hoạch cho nhóm như thế nào?",
  },
  {
    id: "food-diary",
    image: food,
    province: "TP. Hồ Chí Minh",
    title: "Nhật ký ẩm thực: nhớ cả câu chuyện sau món ăn",
    content:
      "Bài viết minh họa: Thay vì chỉ chụp món ăn, người viết thử ghi lại mùi vị, không khí quán và lý do chọn món. Một trang nhật ký ngắn có thể giúp chuyến đi sống động hơn khi đọc lại.\n\nMẫu ghi chép: tên món — điều mình thích — chi phí thực tế — điều muốn thử lần tới. Không cần chấm điểm mọi thứ; đôi khi một cảm nhận chân thành đã đủ để chia sẻ.",
    prompt: "Bạn muốn kể câu chuyện về món ăn nào?",
  },
];
