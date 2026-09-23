QuickCuts Barbershop Queue API

Features

GET – View queue
POST – Add customer
PUT – Update status
DELETE – Remove customer
API Key – Protect POST, PUT, and DELETE
SQLite – Store queue data
Rate Limiting – Limit requests

Queue Fields

- `id` - Unique queue ID
- `customerName` - Customer's name
- `serviceType` - Haircut, Shave, or Haircut + Shave
- `status` - Waiting, In Chair, or Done
- `timeIn` - Time the customer joined the queue
