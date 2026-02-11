# AttendEase - Mobile-First Attendance Management

AttendEase is a mobile-first attendance management application designed specifically for university faculty. It streamlines the process of tracking student attendance, managing class lists, and sharing attendance reports. Built with an offline-first architecture, it ensures reliability even without an internet connection.

**Developed by Gourav Sharma**

## 🚀 Features

- **Offline-First Architecture**: All core data (faculty, classes, students, attendance) is stored locally on the device using `AsyncStorage`, ensuring functionality without internet access.
- **Class & Student Management**: 
    - Create and manage multiple classes.
    - Add students manually or **bulk import from Excel files** (`.xlsx`).
- **Efficient Attendance Taking**: 
    - Quick present/absent toggles for each student.
    - Haptic feedback for interactive elements.
- **WhatsApp Integration**: 
    - Generate formatted attendance summaries (date, class, absentees).
    - Share directly via WhatsApp with a single tap (uses deep linking).
- **Attendance History**: View past attendance records and session details.
- **Modern UI/UX**: Clean interface with intuitive navigation and haptic feedback.

## 🛠 Tech Stack

### Frontend (Mobile/Web)
- **Framework**: [Expo SDK 54](https://expo.dev/) & [React Native 0.81](https://reactnative.dev/)
- **Navigation**: [Expo Router v6](https://docs.expo.dev/router/introduction/) (File-based routing)
- **State Management**: [@tanstack/react-query](https://tanstack.com/query/latest) & React Hooks
- **Storage**: [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) (Local Persistence)
- **Styling**: Standard `StyleSheet` with centralized constants.
- **Icons**: [@expo/vector-icons](https://icons.expo.fyi/)

### Backend (Server)
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js v5](https://expressjs.com/)
- **Database (Server-side)**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/) (Currently acts as a scaffold/landing page; core app logic is client-side).

## 📂 Project Structure

```
├── app/                 # Expo Router pages and navigation logic
│   ├── (tabs)/          # Main tab navigation (Classes, History, Profile)
│   ├── class/[id].tsx   # Class detail & student management screen
│   └── attendance/      # Attendance taking screens
├── components/          # Reusable UI components
├── constants/           # App constants (Colors, Theme settings)
├── lib/                 # Utilities and Storage Logic
│   ├── storage.ts       # Async Storage wrapper & Data Models
│   └── utils.ts         # Helper functions
├── assets/              # Static assets (Images, Fonts)
├── server/              # Express backend server code
│   ├── index.ts         # Server entry point
│   └── routes.ts        # API routes
└── db/                  # Database schema and configuration (using Drizzle)
```

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/client) app on your mobile device (for testing)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/attendease.git
    cd attendease
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npx expo start
    ```

4.  **Run on Device/Emulator:**
    - Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).
    - Press `a` for Android Emulator or `i` for iOS Simulator.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
