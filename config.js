// Chỉnh thông tin thiệp tại đây. Ngày và nội dung mặc định giữ theo trang mẫu.
window.WEDDING_CONFIG = {
  groom: "Trọng Dũng",
  bride: "Thu Cúc",
  groomFull: "Nguyễn Trọng Dũng",
  brideFull: "Trần Thị Thu Cúc",
  groomFather: ".",
  groomMother: ".",
  brideFather: ".",
  brideMother: ".",
  groomAddress: ".",
  brideAddress: ".",
  date: "ch",
  ceremonyTime: ".",
  welcomeTime: ".",
  receptionTime: ".",
  lunarDate: ".",
  ceremonyName: "Lễ thành hôn",
  ceremonyPlace: "Tư gia",
  // Hai địa chỉ được hiển thị riêng trong phần "Tiệc cưới sẽ tổ chức tại".
  groomVenue: "Địa chỉ tiệc cưới nhà trai",
  brideVenue: "Địa chỉ tiệc cưới nhà gái",
  // Thêm tài khoản thật khi sử dụng, ví dụ:
  // { label: "Chú rể", bank: "Vietcombank", name: "TEN CHU TAI KHOAN", number: "...", qr: "assets/images/qr-chu-re.png" }
  giftAccounts: [],

  // Link riêng cho từng bên: tenmien/nha-trai và tenmien/nha-gai (trang gốc "/" là thiệp chung ở trên).
  // Mỗi bên chỉ cần ghi những mục KHÁC thiệp chung; mục nào không ghi thì dùng lại thông tin ở trên.
  // Ghi đè được mọi mục phía trên: date, ceremonyTime, welcomeTime, receptionTime, lunarDate,
  // ceremonyName, ceremonyPlace, giftAccounts...
  // family: "groom" = cô dâu chú rể xếp chú rể trước, chỉ hiện địa chỉ tiệc nhà trai;
  //         "bride" = cô dâu trước, họ nhà gái bên trái, chỉ hiện địa chỉ tiệc nhà gái.
  sides: {
    "nha-trai": {
      family: "groom",
      ceremonyName: "Lễ thành hôn",
      ceremonyPlace: "Tư gia nhà trai",
      // date: "2026-12-20", ceremonyTime: "09:00", welcomeTime: "10:30", receptionTime: "11:00", lunarDate: "Tức ngày ...",
    },
    "nha-gai": {
      family: "bride",
      ceremonyName: "Lễ vu quy",
      ceremonyPlace: "Tư gia nhà gái",
      // date: "2026-12-19", ceremonyTime: "08:00", welcomeTime: "17:00", receptionTime: "17:30", lunarDate: "Tức ngày ...",
    },
  },
};
