# YouTube Downloader Pro API

A modern, full-featured YouTube video and audio downloader built with Node.js, Express, and MongoDB. Includes a beautiful web UI, admin feedback management, and dark mode support.

---

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?logo=windows&logoColor=white" alt="System Type">
  <a href="https://github.com/Adil2641/yt-dl-2">
    <img src="https://img.shields.io/github/stars/Adil2641/yt-dl-2?style=social" alt="GitHub stars">
  </a>
  <a href="https://github.com/Adil2641/yt-dl-2">
    <img src="https://img.shields.io/github/forks/Adil2641/yt-dl-2?style=social" alt="GitHub forks">
  </a>
  <a href="https://github.com/Adil2641/yt-dl-2">
    <img src="https://img.shields.io/github/issues/Adil2641/yt-dl-2" alt="GitHub issues">
  </a>
  <a href="https://github.com/Adil2641/yt-dl-2/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Adil2641/yt-dl-2" alt="License">
  </a>
</p>

---

## 🚀 Features

- 🎬 Download YouTube videos and music in high quality (MP4/MP3)
- ⚡ Fast, direct streaming to the client
- 🌙 Dark mode and responsive web interface
- 📝 User feedback form (stored in MongoDB)
- 🔒 Admin page to view & delete feedback, with server uptime display
- 📦 RESTful API endpoints for easy integration

---

## 🛠️ Technologies Used

- **Node.js** & **Express**
- **MongoDB** (via Mongoose)
- **ytdl-core** (YouTube download)
- **yt-dlp** (for advanced downloads)
- **HTML/CSS/JS** (frontend in `public/`)

---

## 📦 Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Adil2641/yt-dl-2.git
   cd yt-dl-2
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Set up environment variables:**
   - Create a `.env` file in the root directory:
     ```env
     PORT=3000
     ADMIN_KEY=your_admin_key_here
     MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/yt-dl-2?retryWrites=true&w=majority
     ```
   - Replace `<username>`, `<password>`, and `<cluster-url>` with your MongoDB Atlas details.

---

## ▶️ Usage

1. **Start the server:**
   ```sh
   npm start
   ```
2. **Open the web UI:**
   - User page: [http://localhost:3000/](http://localhost:3000/)
   - Admin page: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🌐 API Endpoints

### Download Video/Audio
- **GET `/api/video-download?url=...`** — Download YouTube video (MP4)
- **GET `/api/audio-download?url=...`** — Download YouTube audio (MP3)
- **GET `/api/video-info?url=...`** — Get video info & available qualities

### Feedback
- **POST `/api/feedback`** — Submit feedback
  - Body: `{ name, message }`
- **GET `/api/admin/feedbacks`** — List feedbacks (admin, requires `x-admin-key` header)
- **DELETE `/api/admin/feedbacks/:id`** — Delete feedback by ID (admin)

### Uptime
- **GET `/api/uptime`** — Get server uptime in seconds

---

## 🖥️ Web Interface

- **User Page:**
  - Enter a YouTube URL, get info, and download as MP3/MP4
  - Dark mode toggle, mobile-friendly, progress bar, and feedback form
- **Admin Page:**
  - Enter admin key to view/delete feedback
  - See server uptime at the top

---

## 🤝 Contributing

Pull requests and suggestions are welcome! Please open an issue or PR for improvements or bug fixes.

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 📣 GitHub

- **Repository:** [Adil2641/yt-dl-2](https://github.com/Adil2641/yt-dl-2)
- **Issues:** [Report a bug or request a feature](https://github.com/Adil2641/yt-dl-2/issues)
- **Star this project:** If you like it, please ⭐️ the repo!

---

> **Made with ❤️ by A Dil**