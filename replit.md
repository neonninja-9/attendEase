# AttendEase - Replit Configuration

## Overview

AttendEase is a mobile-first attendance management application designed for university faculty. It enables offline attendance tracking, student management, and attendance sharing via WhatsApp. The app is built with Expo/React Native for the frontend and Express.js for the backend, though the primary data storage is client-side using AsyncStorage (offline-first architecture). Faculty can manage classes, add students (manually or via Excel import), take attendance with present/absent toggles, view attendance history, and share formatted attendance summaries through WhatsApp.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Routing**: Expo Router v6 with file-based routing and typed routes
  - Tab navigation: `(tabs)/` with three tabs — Classes (index), History, Profile
  - Stack screens: `class/[id]` for class detail/student management, `attendance/[classId]` for taking attendance
- **State Management**: React Query (`@tanstack/react-query`) for server state; local `useState` for UI state
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **Styling**: Plain `StyleSheet.create()` with a centralized color constants file at `constants/colors.ts` (light theme only, teal/green accent colors)
- **Haptics**: `expo-haptics` used for tactile feedback on interactions
- **Platform Support**: iOS, Android, and Web — with platform-specific adaptations (e.g., `KeyboardAwareScrollViewCompat`, blur tab bar on iOS, liquid glass detection)

### Offline-First Data Layer

- **Primary Storage**: `@react-native-async-storage/async-storage` — all core data (faculty, classes, students, attendance records, sessions) is stored on-device
- **Data Models** (defined in `lib/storage.ts`):
  - `Faculty`: id, name, whatsappNumber
  - `ClassItem`: id, courseName, subjectCode
  - `Student`: id, name, rollNumber, classId
  - `AttendanceRecord`: id, studentId, date, status (present/absent), sessionId, classId
  - `AttendanceSession`: id, classId, date, createdAt
- **IDs**: Generated using `expo-crypto` (UUID)
- **Default Data**: Pre-seeded classes are initialized on first launch via `initializeDefaults()`
- **File Import**: Students can be bulk-imported from Excel files using `expo-document-picker` and `xlsx` library

### Backend (Express.js)

- **Server**: Express v5 running on Node.js, located in `server/`
- **Purpose**: Currently minimal — serves as a landing page and potential API host. The app is primarily offline-first, so the server has very few routes
- **CORS**: Configured to allow Replit dev/deployment domains and localhost origins
- **Database Schema** (server-side, `shared/schema.ts`): Drizzle ORM with PostgreSQL dialect — currently only has a `users` table. This is a scaffold; the app's actual data lives client-side
- **Storage Layer** (`server/storage.ts`): In-memory storage (`MemStorage`) with a basic user CRUD interface — serves as a starting point for server-side features
- **Static Build**: Web export build pipeline via `scripts/build.js` for production deployment

### Build & Development

- **Dev workflow**: Two processes — `expo:dev` for the Expo dev server and `server:dev` for the Express backend (via `tsx`)
- **Production build**: `expo:static:build` exports static web assets; `server:build` bundles the server with `esbuild`; `server:prod` serves the built output
- **Database migrations**: `drizzle-kit push` for schema sync (when PostgreSQL is provisioned)
- **Linting**: ESLint with `eslint-config-expo/flat`
- **Patches**: `patch-package` runs on postinstall

### Key Feature: WhatsApp Integration

- Attendance submission generates a formatted text summary (date, class name, absentee roll numbers)
- Uses `Linking.openURL` with the WhatsApp URL scheme (`https://wa.me/?text=...`) to share pre-filled attendance messages
- No server communication required — fully offline

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required by Drizzle ORM configuration (`DATABASE_URL` env var). Currently only used for the `users` table scaffold on the server side. The app's core functionality does not depend on it — all attendance data is stored client-side
- **Replit Environment**: Uses `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, and `REPLIT_INTERNAL_APP_DOMAIN` env vars for CORS, proxy configuration, and build deployment

### Key NPM Packages
- `expo` (~54.0.27) — Core framework
- `expo-router` (~6.0.17) — File-based navigation
- `@tanstack/react-query` (^5.83.0) — Data fetching/caching
- `drizzle-orm` (^0.39.3) + `drizzle-zod` — Server-side ORM and validation
- `pg` (^8.16.3) — PostgreSQL client
- `express` (^5.0.1) — Backend server
- `@react-native-async-storage/async-storage` (2.2.0) — On-device persistence
- `xlsx` — Excel file parsing for student import
- `expo-document-picker` — File selection for import
- `expo-haptics` — Tactile feedback
- `expo-crypto` — UUID generation
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens` — Navigation and animation infrastructure