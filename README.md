# RollCall

A decentralized event check-in system powered by Nostr. RollCall enables event organizers to create attendance-tracking events and participants to securely check in using their Nostr identity.

## Features

- **Event Creation & Management**: Create and manage events with custom fields, QR codes, and check-in tracking.
- **QR Code Check-ins**: Scan QR codes or enter event codes to check in to events.
- **Event Discovery**: Browse and import events from Flockstr.
- **Event Search & Filtering**: Find events by title, location, or tags.
- **Event Bookmarks**: Save and organize your favorite events.
- **Attendance Analytics**: View detailed check-in statistics and analytics.
- **Profile Management**: Complete Nostr profile management with metadata editing.
- **+chorus Integration**: Propose events to communities and share attendance.
- **Mobile-First Design**: Responsive design optimized for mobile devices.
- **Dark Mode Support**: Complete light/dark theme system.

## +chorus Integration

RollCall integrates with +chorus communities to enhance event discovery and social sharing.

### Event Proposals
When creating events, users can optionally propose their events to +chorus communities:
- Toggle to enable community proposal during event creation.
- Enter the community ID (naddr format).
- Automatically creates a community post with event details.
- Includes event metadata, links, and relevant hashtags.

### Attendance Sharing
After checking in to events, users can share their attendance with communities:
- Optional toggle to share attendance with a specific community.
- Creates a community post announcing attendance.
- Includes event details and personal information (if provided).
- Helps build community engagement around events.

### Community Discovery
- Events proposed to communities appear in community feeds.
- Community members can discover events through social sharing.
- Enables cross-platform event discovery between RollCall and +chorus.

## Technology Stack

- **React 18.x**: Modern React with hooks and concurrent features.
- **TypeScript**: Type-safe JavaScript development.
- **TailwindCSS 3.x**: Utility-first CSS framework.
- **Vite**: Fast build tool and development server.
- **shadcn/ui**: Accessible UI components built with Radix UI.
- **Nostrify**: Nostr protocol framework for web applications.
- **TanStack Query**: Data fetching and state management.
- **React Router**: Client-side routing.

## Design Philosophy

RollCall's user interface follows a mobile-first, minimalist design:

- **Mobile-first**: Optimized for mobile devices with responsive design for all screen sizes.
- **Clean and minimal**: Decluttered interface with focused content and reduced visual noise.
- **Monochromatic base**: A clean, primarily monochromatic design with strategic accent colors.
- **Typography-driven**: Clear typographic hierarchy with high readability.
- **Functional aesthetics**: Beauty follows function; design serves the user experience.
- **Consistent patterns**: Reusable, consistent UI elements throughout the application.
- **Subtle interactivity**: Thoughtful animations and transitions enhance without distracting.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rollcall
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Creating and Managing an Event

1. Log in with your Nostr identity.
2. Navigate to "Create & Manage".
3. Fill in event details (name, description, date, location).
4. View your created events in the same section to manage them, view attendance data, and generate new codes.

### Checking In to an Event

1. Log in with your Nostr identity.
2. Navigate to "Check In".
3. Scan the QR code or enter the event code.
4. Confirm your attendance.
5. View your attendance certificate in "My Attendance".

## Architecture

RollCall uses a decentralized architecture built on Nostr:

- **Nostr Protocol** - Decentralized identity and data storage
- **Event Kinds** - Custom Nostr event types for event data
- **Attendance Tracking** - Verifiable attendance records
- **QR Code Integration** - Easy check-in process

## Development

### Project Structure

```
src/
├── components/     # UI components
│   ├── ui/         # Basic UI components (shadcn/ui)
│   ├── auth/       # Authentication-related components
│   └── layout/     # Layout components like AppLayout
├── hooks/         # Custom React hooks
├── pages/         # Page components
│   ├── events/     # Event-related pages
│   ├── profile/    # User profile page
│   └── ...
├── contexts/      # React context providers
├── lib/           # Utility functions
└── test/          # Testing utilities
```

### UI Components

The application uses a shared `AppLayout` component that provides consistent header and footer across all pages:

```tsx
<AppLayout>
  {/* Page content goes here */}
</AppLayout>
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint

### Testing

The project uses Vitest for testing with React Testing Library:

```bash
npm run test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Acknowledgments

Built with [MKStack](https://soapbox.pub/mkstack) - A template for building Nostr client applications.