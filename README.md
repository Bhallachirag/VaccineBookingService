# Booking Service — VaxFlow

The core transactional service of VaxFlow — turns a cart of vaccines into a paid, confirmed booking. Handles cart checkout, FIFO batch-based pricing, Razorpay payments, and coordinates with the Vaccine, Auth, and Reminder services to complete a booking end-to-end.

## What it does

- **FIFO batch costing**: when an order is placed, the service pulls all inventory batches for a vaccine from the Vaccine & Search Service, sorts them by expiry date, and consumes stock starting from the batch closest to expiring. Cost is calculated against the batch actually being used, not a flat per-vaccine price.
- **Cart checkout**: `/cart/checkout` accepts multiple vaccines in a single request and runs the FIFO costing logic across every item before generating one combined payment link.
- **Razorpay integration**: creates a payment link for the calculated order total, and exposes a webhook endpoint that Razorpay calls back on payment success — which is what actually confirms the booking and deducts the reserved stock.
- **Cross-service calls**: talks to the Auth Service to validate the user and the Vaccine & Search Service to check and deduct stock, using internal service URLs set via environment variables.
- **Reminder trigger**: once a booking is confirmed, the service calls the Reminder Service to send a confirmation email for the order.
- **Booking history**: endpoints to fetch a user's bookings, a single booking by ID, or all bookings (admin view).

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/v1/cart/checkout` | Checkout a cart of vaccines, returns a Razorpay payment link |
| POST | `/api/v1/bookings` | Create a single booking |
| GET | `/api/v1/bookings/:id` | Get a booking by ID |
| GET | `/api/v1/bookings/user/:userId` | Get all bookings for a user |
| GET | `/api/v1/bookings/all` | Get all bookings (admin) |
| GET | `/api/v1/test-reminder/:orderId` | Manually trigger a reminder email for testing |
| GET | `/api/v1/info` | Service health/info |

## How it fits in

```
Client → API Gateway → Booking Service
                            ↳ Auth Service        (verify user)
                            ↳ Vaccine Service      (check + deduct inventory, FIFO by expiry)
                            ↳ Razorpay             (payment link + webhook confirmation)
                            ↳ Reminder Service      (send confirmation email)
```

## Tech Stack

Node.js · Express 5 · Sequelize · MySQL · Razorpay · Axios · `node-cron`

## Getting Started

```bash
npm install
npx sequelize-cli db:migrate
npm start
```

### Environment variables

```env
PORT=4002
NODE_ENV=development
DB_USERNAME=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_HOST=127.0.0.1
DB_DIALECT=mysql
DB_NAME_DEVELOPMENT=vaxflow_booking_dev
DB_NAME_PRODUCTION=vaxflow_booking
DB_SYNC=true
AUTH_SERVICE_PATH=http://localhost:4001
VACCINE_SERVICE_PATH=http://localhost:4000
REMINDER_SERVICE_PATH=http://localhost:4003
VACCINE_FRONTEND_PATH=http://localhost:5173
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

## Part of the VaxFlow microservices

- [Frontend](https://github.com/Bhallachirag/FinalFrontend)
- [API Gateway](https://github.com/Bhallachirag/API_Gateway)
- [Auth Service](https://github.com/Bhallachirag/Auth_Service)
- [Vaccine & Search Service](https://github.com/Bhallachirag/VaccineAndSearchService)
- **Booking Service** (this repo)
- [Reminder Service](https://github.com/Bhallachirag/ReminderService)

### Author

- **Chirag Bhalla**
