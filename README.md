# 🎙️ Discord TTS Soundboard Bot & Mobile Remote Controller

Ứng dụng Discord Voice Bot thay thế Soundboard hỗ trợ giao tiếp bằng giọng nói Tiếng Việt (Edge TTS) với giao diện điều khiển dành riêng cho Điện thoại (Web Remote Mobile App).

---

## 🌟 Tính năng chính

- 🤖 **Lệnh gọi vào Voice tự động**: Gõ `/gummyajoin` trong Discord để Bot tự động vào Kênh thoại bạn đang ngồi.
- ⏱️ **Tự động Rời phòng**: Tự động thoát Kênh thoại sau 10 giây khi phòng không còn ai.

- ⚙️ **Tự do Quản lý Nút bấm (Dynamic Grid Builder)**: Thêm, sửa tên nút, chỉnh câu đọc TTS, chọn Icon (Emoji) và màu sắc cho từng nút trực tiếp trên điện thoại.
- 🗣️ **Giọng đọc Tiếng Việt tự nhiên (Microsoft Edge TTS)**: Sử dụng miễn phí 100% không cần API key với giọng đọc Nam (`vi-VN-NamMinhNeural`) và Nữ (`vi-VN-HoaiMyNeural`).
- ✍️ **Gõ văn bản tự do (Custom Speech Input)**: Nhập câu thoại bất kỳ trên điện thoại -> Ấn gửi để Bot cất giọng đọc tức thì vào kênh đàm thoại Discord.
- 🚀 **Sẵn sàng Deploy Railway 24/7 (Truy cập 4G từ bất kỳ đâu)**: Tích hợp sẵn `Dockerfile` có bao gồm `ffmpeg` hỗ trợ phát audio mượt mà trên Railway Cloud.

---

## 🚀 Hướng dẫn Đẩy Code lên GitHub & Host trên Railway

### 1. Đẩy Code lên GitHub Repository của bạn:

Mở Terminal tại thư mục này và chạy các lệnh sau:

```bash
git init
git add .
git commit -m "Initial commit: Discord TTS Soundboard Bot with Mobile Remote"
git branch -M main
git remote add origin https://github.com/gongmya11/discordbotTTS.git
git push -u origin main
```

---

### 2. Triển khai lên Railway (Cloud Hosting):

1. Truy cập [Railway.app](https://railway.app) và đăng nhập bằng tài khoản GitHub của bạn.
2. Bấm nút **"New Project"** -> Chọn **"Deploy from GitHub repo"**.
3. Chọn Repository `discordbotTTS`.
4. Vào mục **Variables** (Biến môi trường) trên Railway và thêm các biến sau:
   - `DISCORD_TOKEN`: Token của Bot Discord (Lấy từ [Discord Developer Portal](https://discord.com/developers/applications))
   - `CLIENT_ID`: Application ID của Bot.
   - `GUILD_ID` *(Tùy chọn)*: ID của Server Discord mặc định.
   - `VOICE_CHANNEL_ID` *(Tùy chọn)*: ID của Kênh Voice mặc định để Bot tự động vào khi bật.
5. Vào mục **Networking** -> Bấm **"Generate Domain"** để Railway cấp đường dẫn public HTTPS (ví dụ: `https://discordbottts-production.up.railway.app`).

---

### 3. Hướng dẫn Sử dụng trên Điện thoại (dùng 4G hoặc Wi-Fi):

1. Mở trình duyệt (Safari / Chrome) trên điện thoại và truy cập vào đường dẫn domain từ Railway.
2. Bấm vào icon **Micro (Kênh Voice)** ở góc trên để chọn Server & Kênh Voice mà nhóm bạn đang đàm thoại.
3. Chạm vào bất kỳ nút **Quick Callout** nào (`Lên top`, `Ra mid`, `Roshan`, `Cắm mắt`...) để Bot cất giọng đọc vào kênh Discord!
4. Giữ lì vào nút bấm hoặc bấm icon **Bánh răng (⚙️)** để thêm / sửa / xóa các nút bấm theo ý muốn của bạn.
