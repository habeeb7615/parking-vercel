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
      font-size: 11px;
      width: 80mm;
      max-width: 80mm;
      min-width: 80mm;
      margin: 0 auto;
      padding: 8px;
      line-height: 1.3;
      display: block;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header h1 {
      font-size: 16px;
      margin: 4px 0;
      font-weight: bold;
    }
    .header p {
      font-size: 10px;
      margin: 2px 0;
    }
    .receipt-info {
      margin: 8px 0;
    }
    .receipt-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: 11px;
    }
    .receipt-label {
      font-weight: bold;
    }
    .receipt-value {
      text-align: right;
    }
    .separator {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .total {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 8px 0;
      margin: 8px 0;
      text-align: center;
    }
    .total-label {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .total-amount {
      font-size: 18px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      font-size: 10px;
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
        padding: 5mm;
        display: inline-block;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PARKFLOW</h1>
    <p>Parking Receipt</p>
  </div>
  
  <div class="receipt-info">
    <div class="receipt-row">
      <span class="receipt-label">Receipt No:</span>
      <span class="receipt-value">${receiptNumber}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Date & Time:</span>
      <span class="receipt-value">${formatDateTime(checkoutDate)}</span>
    </div>
  </div>
  
  <div class="separator"></div>
  
  <div class="receipt-info">
    <div class="receipt-row">
      <span class="receipt-label">Plate Number:</span>
      <span class="receipt-value">${vehicle.plate_number}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Vehicle Type:</span>
      <span class="receipt-value">${vehicle.vehicle_type === '2-wheeler' ? '2 Wheeler' : '4 Wheeler'}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Check In Time:</span>
      <span class="receipt-value">${formatTime(vehicle.check_in_time)}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Check Out Time:</span>
      <span class="receipt-value">${vehicle.check_out_time ? formatTime(vehicle.check_out_time) : formatDateTime(checkoutDate)}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Duration:</span>
      <span class="receipt-value">${duration}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Payment Method:</span>
      <span class="receipt-value">${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
    </div>
  </div>
  
  <div class="separator"></div>
  
  <div class="total">
    <div class="total-label">Total Amount</div>
    <div class="total-amount">₹${paymentAmount.toFixed(2)}</div>
  </div>
  
  <div class="footer">
    <p>Thank you for using ParkFlow!</p>
    <p>Please keep this receipt safe</p>
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
