# DCF Calculator App

## Overview
This is a DCF (Discounted Cash Flow) Calculator application built with Next.js 16, React 19, TypeScript, and Tailwind CSS. The app helps users calculate the intrinsic value of stocks using the DCF valuation method.

## Project Information
- **Name**: dcf-app
- **Version**: 0.1.0
- **Framework**: Next.js 16.0.4 with React 19.2.0
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Type**: Frontend-only application

## Project Structure
```
/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main DCF calculator component
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── favicon.ico        # Favicon
├── public/                # Static assets
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies and scripts
```

## Recent Changes (November 28, 2025)
- Configured Next.js to run on port 5000 with host 0.0.0.0 for Replit environment
- Set up workflow for development server
- Configured allowed origins for Replit proxy compatibility
- Installed all npm dependencies

## Running the Application
The application runs automatically via the configured workflow:
- **Development**: `npm run dev` - Runs on http://0.0.0.0:5000
- **Build**: `npm run build` - Creates production build
- **Production**: `npm start` - Runs production server on http://0.0.0.0:5000

## Configuration
- **Port**: 5000 (required for Replit webview)
- **Host**: 0.0.0.0 (allows Replit proxy access)
- **Server Actions**: Configured to allow all origins in development mode for Replit compatibility

## Features
The DCF Calculator allows users to:
- Calculate stock intrinsic value using DCF methodology
- Input financial metrics (FCF, WACC, growth rates, etc.)
- Import data from financial statements
- View detailed calculation breakdowns
- Compare calculated value with current market price

## User Preferences
None specified yet.

## Technical Notes
- The app uses Next.js 16 with the App Router (app directory structure)
- Turbopack is enabled by default for faster development builds
- Client-side rendering is used for interactive calculator functionality
- The interface is in Turkish language
