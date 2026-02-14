# CRM Backend Implementation

## Overview
Complete backend implementation for the CRM (Customer Relationship Management) module for the Shinepos restaurant management system.

## Files Created

### 1. Models (src/models/)
- **Customer.js** - Customer data with loyalty points tracking
- **LoyaltySettings.js** - Loyalty program configuration
- **Review.js** - Customer feedback and reviews
- **Campaign.js** - Marketing campaigns (email/SMS)

### 2. Controller (src/controllers/)
- **crmController.js** - All CRM business logic

### 3. Routes (src/routes/)
- **crm.js** - API endpoints for CRM features

### 4. Updated Files
- **server.js** - Added CRM routes registration
- **TenantModelFactory.js** - Enhanced to support generic CRM models

## API Endpoints

### Customer Sync
- `POST /api/customers/sync` - Import customers from existing orders (Admin only)

### Customer Management
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/:customerId/orders` - Get customer order history

### Loyalty Program
- `GET /api/customers/loyalty` - Get customers sorted by loyalty points
- `GET /api/loyalty/settings` - Get loyalty program settings
- `PUT /api/loyalty/settings` - Update loyalty settings (points per rupee, redeem rate)

### Marketing Campaigns
- `GET /api/campaigns` - Get all campaigns
- `POST /api/campaigns` - Create new campaign
- `POST /api/campaigns/:id/send` - Send campaign to target audience

### Reviews & Feedback
- `GET /api/reviews` - Get all reviews
- `PATCH /api/reviews/:id` - Update review status (pending/resolved)

## Features Implemented

### Automatic Customer Data Population
- **Auto-sync from orders**: Customers are automatically created/updated when orders are placed
- **Manual sync**: Use `POST /api/customers/sync` to import all existing order data
- **Loyalty points**: Automatically calculated and added based on order amount
- **Order tracking**: Total orders and spending tracked automatically

### Customer Database
- Store customer contact information
- Track total orders and spending
- Manage loyalty points
- View customer order history

### Loyalty Program
- Configurable points per rupee spent
- Configurable redemption rate
- Automatic tier calculation (Bronze, Silver, Gold, Platinum)
- Track earned and redeemed points

### Marketing Campaigns
- Email and SMS campaign support
- Target audience filtering:
  - All customers
  - VIP customers (by spending threshold)
  - Frequent customers (by order count)
- Campaign status tracking (draft, scheduled, sent)
- Track sent count and reach

### Feedback & Reviews
- Customer ratings (1-5 stars)
- Review comments
- Link reviews to orders
- Status management (pending/resolved)
- Statistics calculation (average rating, positive/negative counts)

## Authentication & Authorization
All endpoints require:
- JWT authentication
- Restaurant admin or manager role
- Active subscription
- Tenant isolation (multi-tenant support)

## Multi-Tenant Support
All CRM data is isolated per restaurant using the TenantModelFactory pattern, ensuring complete data separation between different restaurants.

## Next Steps
1. Test all endpoints with Postman or similar tool
2. Verify frontend integration
3. Add email/SMS integration for campaigns (optional)
4. Add customer import/export functionality (optional)
