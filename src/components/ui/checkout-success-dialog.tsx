import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { CheckCircle, Receipt, Clock, Car, Bike, Printer } from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type: '2-wheeler' | '4-wheeler';
  check_in_time: string;
  check_out_time?: string;
  payment_amount?: number;
  payment_method?: string;
  receipt_id?: string;
  contractors?: {
    company_name?: string;
    contact_number?: string;
    rates_2wheeler?: {
      upTo2Hours?: number;
      upTo6Hours?: number;
      upTo12Hours?: number;
      upTo24Hours?: number;
    };
    rates_4wheeler?: {
      upTo2Hours?: number;
      upTo6Hours?: number;
      upTo12Hours?: number;
      upTo24Hours?: number;
    };
  };
}

interface CheckoutSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  paymentAmount: number;
  paymentMethod: string;
  duration: string;
}

export function CheckoutSuccessDialog({
  isOpen,
  onClose,
  vehicle,
  paymentAmount,
  paymentMethod,
  duration
}: CheckoutSuccessDialogProps) {
  if (!vehicle) return null;

  // Generate receipt number - prioritize backend receipt_id
  const generateReceiptNumber = (): string => {
    if (vehicle.receipt_id) {
      return vehicle.receipt_id;
    }
    
    // Fallback: Generate receipt number if backend receipt_id not available
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCPT-${dateStr}-${timeStr}-${random}`;
  };

  const handlePrint = () => {
    const receiptNumber = generateReceiptNumber();
    const checkoutDate = vehicle.check_out_time 
      ? new Date(vehicle.check_out_time) 
      : new Date();
    
    const formatDateTime = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    };

    const formatTime = (dateStr: string): string => {
      const date = new Date(dateStr);
      return formatDateTime(date);
    };

    const receiptContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Parking Receipt</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 5mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html {
      width: 100%;
      margin: 0;
      padding: 0;
      display: block;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      min-width: 80mm;
      margin: 0 auto;
      padding: 8px;
      line-height: 1.3;
      display: block;
    }
    .title {
      text-align: center;
      font-weight: bold;
      font-size: 18px;
      margin: 0 0 4px 0;
    }
    .subtitle {
      text-align: center;
      margin-bottom: 8px;
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .top-row span:first-child {
      font-weight: bold;
    }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 6px 0 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      font-size: 12px;
    }
    .row span:first-child {
      font-weight: bold;
    }
    .total-section {
      margin: 12px 0;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-weight: bold;
      font-size: 12px;
    }
    .total-divider-top,
    .total-divider-bottom {
      border: none;
      border-top: 2px solid #000;
      margin: 0;
    }
    .amount {
      font-size: 16px;
    }
    .rates-title {
      text-align: center;
      margin: 6px 0;
      font-weight: bold;
      font-size: 11px;
    }
    .rates {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 10px;
      gap: 20px;
    }
    .rates .col {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .rates .col div {
      margin-bottom: 2px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .rates .col div span:first-child {
      white-space: nowrap;
    }
    .footer {
      text-align: center;
      margin-top: 8px;
      font-size: 12px;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 5mm;
      }
      html {
        width: 100%;
        margin: 0;
        padding: 0;
        display: block;
        text-align: center;
      }
      body {
        width: 80mm;
        max-width: 80mm;
        min-width: 80mm;
        margin: 0 auto;
        padding: 2mm;
        display: inline-block;
        text-align: left;
        font-size: 12px;
      }
    }
  </style>
</head>
<body>
  <h1 class="title">PARKFLOW</h1>
  <div class="subtitle">Parking Receipt</div>
  ${vehicle.contractors?.company_name || vehicle.contractors?.contact_number ? `
  <div class="top-row">
    <span>${vehicle.contractors?.company_name || ''}</span>
    ${vehicle.contractors?.contact_number ? `<span>Contact: ${vehicle.contractors.contact_number}</span>` : ''}
  </div>
  <hr class="divider" />
  ` : ''}
  
  <div class="row">
    <span>Receipt No:</span>
    <span>${receiptNumber}</span>
  </div>
  <div class="row">
    <span>Date & Time:</span>
    <span>${formatDateTime(checkoutDate)}</span>
  </div>
  <hr class="divider" />
  <div class="row">
    <span>Plate Number:</span>
    <span>${vehicle.plate_number}</span>
  </div>
  <div class="row">
    <span>Vehicle Type:</span>
    <span>${vehicle.vehicle_type === '2-wheeler' ? '2 Wheeler' : '4 Wheeler'}</span>
  </div>
  <div class="row">
    <span>Check In Time:</span>
    <span>${formatTime(vehicle.check_in_time)}</span>
  </div>
  <div class="row">
    <span>Check Out Time:</span>
    <span>${vehicle.check_out_time ? formatTime(vehicle.check_out_time) : formatDateTime(checkoutDate)}</span>
  </div>
  <div class="row">
    <span>Duration:</span>
    <span>${duration}</span>
  </div>
  <div class="row">
    <span>Payment Method:</span>
    <span>${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
  </div>
  
  <div class="total-section">
    <hr class="total-divider-top" />
    <div class="total-row">
      <span>Total Amount</span>
      <span class="amount">₹${paymentAmount.toFixed(2)}</span>
    </div>
    <hr class="total-divider-bottom" />
  </div>
  
  ${vehicle.contractors?.rates_2wheeler || vehicle.contractors?.rates_4wheeler ? `
  <hr class="divider" />
  <h3 class="rates-title">Parking Rates</h3>
  <div class="rates">
    ${vehicle.vehicle_type === '2-wheeler' && vehicle.contractors?.rates_2wheeler ? `
    <div class="col">
      <div><span>Up to 2 Hours:</span><span>₹${vehicle.contractors.rates_2wheeler.upTo2Hours || 0}</span></div>
      <div><span>Up to 6 Hours:</span><span>₹${vehicle.contractors.rates_2wheeler.upTo6Hours || 0}</span></div>
    </div>
    <div class="col">
      <div><span>Up to 12 Hours:</span><span>₹${vehicle.contractors.rates_2wheeler.upTo12Hours || 0}</span></div>
      <div><span>Up to 24 Hours:</span><span>₹${vehicle.contractors.rates_2wheeler.upTo24Hours || 0}</span></div>
    </div>
    ` : ''}
    ${vehicle.vehicle_type === '4-wheeler' && vehicle.contractors?.rates_4wheeler ? `
    <div class="col">
      <div><span>Up to 2 Hours:</span><span>₹${vehicle.contractors.rates_4wheeler.upTo2Hours || 0}</span></div>
      <div><span>Up to 6 Hours:</span><span>₹${vehicle.contractors.rates_4wheeler.upTo6Hours || 0}</span></div>
    </div>
    <div class="col">
      <div><span>Up to 12 Hours:</span><span>₹${vehicle.contractors.rates_4wheeler.upTo12Hours || 0}</span></div>
      <div><span>Up to 24 Hours:</span><span>₹${vehicle.contractors.rates_4wheeler.upTo24Hours || 0}</span></div>
    </div>
    ` : ''}
  </div>
  <hr class="divider" />
  ` : ''}
  
  <div class="footer">
    <div>Thank you for using ParkFlow!</div>
    <div>Please keep this receipt safe</div>
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Checkout Successful
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vehicle Message */}
          <p className="text-gray-600 text-center">
            Vehicle <span className="font-bold text-gray-900">**{vehicle.plate_number}**</span> has been checked out.
          </p>

          {/* Separator Line */}
          <div className="border-t border-gray-200"></div>

          {/* Payment Due */}
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">Payment Due</div>
            <div className="text-4xl font-bold text-blue-600">
              ₹{paymentAmount.toFixed(2)}
            </div>
          </div>

          {/* Print Receipt Button */}
          <div className="pt-2">
            <Button 
              onClick={handlePrint}
              variant="outline"
              className="w-full border-blue-600 text-blue-600 hover:text-blue-600 hover:bg-blue-50 py-3"
            >
              <Printer className="h-5 w-5 mr-2" />
              Print Receipt
            </Button>
          </div>

          {/* Done Button */}
          <div className="pt-2">
            <Button 
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
