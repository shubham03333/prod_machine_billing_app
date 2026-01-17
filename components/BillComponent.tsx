"use client"

import React, { useState } from 'react'
import html2canvas from 'html2canvas'

interface Payment {
  id: number
  rentalId: number
  amount: number
  mode: string
  date: string
}

interface Rental {
  id: number
  machineType: string
  unitType: string
  quantity: number
  acreage?: number
  pricePerUnit: number
  totalAmount: number
  description?: string
  operator: { name: string }
  date: string
  dieselCost: number
  maintenanceCost: number
  operatorSalary: number
  paidAmount: number
  paymentStatus: string
  paymentMode?: string
  payments: Payment[]
  normalHourlyRate?: number
  breakerHourlyRate?: number
  timeSlots?: Array<{ startTime: string; endTime: string; isBreaker: boolean; calculatedAmount: number }>
}

interface Bill {
  id: number
  billNumber: string
  customer: { name: string; address?: string; contactNumber: string }
  rentals: Rental[]
  totalAmount: number
  paidAmount: number
  status: string
  dueDate?: string
  createdAt: string
}

interface BillComponentProps {
  bill: Bill
  onClose: () => void
  onPrint: () => void
}

const BillComponent: React.FC<BillComponentProps> = ({ bill, onClose, onPrint }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'english' | 'marathi'>('english')

  const translations = {
    english: {
      billTitle: 'JD Agro & Earthmovers Bill',
      billNo: 'Bill No',
      customer: 'Customer',
      date: 'Date',
      dueDate: 'Due Date',
      totalAmount: 'Total Amount',
      paidAmount: 'Paid Amount',
      balanceDue: 'Balance Due',
      rentalDetails: 'Rental Details',
      thankYou: 'Thank you for your business!',
      contact: 'Contact: +91-7558379410'
    },
    marathi: {
      billTitle: 'जेड अॅग्रो अँड अर्थमोव्हर्स बिल',
      billNo: 'बिल क्रमांक',
      customer: 'ग्राहक',
      date: 'तारीख',
      dueDate: 'नियत तारीख',
      totalAmount: 'एकूण रक्कम',
      paidAmount: 'दिलेली रक्कम',
      balanceDue: 'शिल्लक रक्कम',
      rentalDetails: 'भाडे तपशील',
      thankYou: 'आमच्या सेवेसाठी धन्यवाद!',
      contact: 'संपर्क: +91-7558379410'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const formatDateDDMMYYYY = (date: string | Date) => {
    const d = new Date(date)
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0

    // Handle different time formats
    let startTime = start
    let endTime = end

    // If time includes seconds, remove them
    if (start.includes(':')) {
      const startParts = start.split(':')
      startTime = `${startParts[0]}:${startParts[1]}`
    }
    if (end.includes(':')) {
      const endParts = end.split(':')
      endTime = `${endParts[0]}:${endParts[1]}`
    }

    const startDate = new Date(`2000-01-01T${startTime}:00`)
    let endDate = new Date(`2000-01-01T${endTime}:00`)

    if (endDate < startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000) // add 24 hours for overnight shifts
    }

    const diffMs = endDate.getTime() - startDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return Math.max(0, diffHours)
  }

  const getRentalDescription = (rental: Rental) => {
    if (rental.machineType === 'harvester') {
      return `Harvester – ${rental.quantity} ${rental.unitType}${rental.description ? ` (${rental.description})` : ''}`
    } else if (rental.machineType === 'excavator' && rental.unitType === 'hourly') {
      const normalHours = rental.timeSlots?.filter(slot => !slot.isBreaker).reduce((sum, slot) => sum + calculateHours(slot.startTime, slot.endTime), 0) || 0
      const breakerHours = rental.timeSlots?.filter(slot => slot.isBreaker).reduce((sum, slot) => sum + calculateHours(slot.startTime, slot.endTime), 0) || 0
      return `JCB${rental.description ? ` (${rental.description})` : ''}`
    } else if (rental.machineType === 'excavator') {
      return `JCB – ${rental.quantity} ${rental.unitType}${rental.description ? ` (${rental.description})` : ''}`
    } else {
      return `${rental.machineType.charAt(0).toUpperCase() + rental.machineType.slice(1)} – ${rental.quantity} ${rental.unitType}${rental.description ? ` (${rental.description})` : ''}`
    }
  }

  const getAllPayments = () => {
    const allPayments: Array<{ amount: number; mode: string; date: string }> = []
    bill.rentals.forEach(rental => {
      rental.payments.forEach(payment => {
        allPayments.push({
          amount: payment.amount,
          mode: payment.mode,
          date: payment.date
        })
      })
    })
    return allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const totalPaid = bill.paidAmount
  const balanceDue = bill.totalAmount - totalPaid

  const shareBillOnWhatsApp = () => {
    const customerPhone = bill.customer.contactNumber.replace(/\D/g, '') // Remove non-numeric characters
    const t = translations[selectedLanguage]

    const billText = `*${t.billTitle}*

${t.billNo}: ${bill.billNumber}
${t.customer}: ${bill.customer.name}
${t.date}: ${formatDateDDMMYYYY(bill.createdAt)}
${bill.dueDate ? `${t.dueDate}: ${formatDateDDMMYYYY(bill.dueDate)}\n` : ''}
*${t.totalAmount}:* ₹${bill.totalAmount.toLocaleString('en-IN')}
*${t.paidAmount}:* ₹${totalPaid.toLocaleString('en-IN')}
*${t.balanceDue}:* ₹${balanceDue.toLocaleString('en-IN')}

*${t.rentalDetails}:*
${bill.rentals.map(rental => `- ${getRentalDescription(rental)}: ₹${rental.totalAmount.toLocaleString('en-IN')}`).join('\n')}

${t.thankYou}
${t.contact}`

    const whatsappUrl = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(billText)}`
    window.open(whatsappUrl, '_blank')
  }

  const shareBillAsImageOnWhatsApp = async () => {
    const billElement = document.getElementById('bill-component')
    if (!billElement) return

    try {
      const canvas = await html2canvas(billElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true
      })
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to generate blob'))
          }
        }, 'image/png')
      })
      const file = new File([blob], `bill-${bill.billNumber}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Bill',
          text: 'Here is your bill',
          files: [file]
        })
      } else {
        // Fallback: download the image and open WhatsApp with instructions
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bill-${bill.billNumber}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Open WhatsApp with detailed message including attachment instructions
        const customerPhone = bill.customer.contactNumber.replace(/\D/g, '')
        const t = translations[selectedLanguage]
        const message = `${t.thankYou}. Your bill has been downloaded to your device. Please attach the downloaded bill-${bill.billNumber}.png file to this message.`
        const whatsappUrl = `https://wa.me/91${customerPhone}?text=${encodeURIComponent(message)}`
        window.open(whatsappUrl, '_blank')

        // Show user-friendly alert with instructions
        alert(`Bill image downloaded as bill-${bill.billNumber}.png. WhatsApp has been opened - please attach the downloaded image file to your message to the customer.`)
      }
    } catch (error) {
      console.error('Error generating bill image:', error)
      alert('Failed to generate bill image. Please try again.')
    }
  }

  return (
    <div id="bill-component" className="w-full max-w-4xl mx-auto bg-white p-3 sm:p-4 lg:p-6 shadow-xl print:shadow-none print:p-3 border border-gray-200 print:border-none">
      {/* Enhanced Header */}
      <div className="text-center mb-2 sm:mb-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white py-2 sm:py-3 px-2 sm:px-3 rounded-lg print:bg-white print:text-black print:border-b-2 print:border-gray-300 print:py-2">
        {/* Company Logo Placeholder */}
        <div className="mb-1 sm:mb-2 print:mb-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full mx-auto flex items-center justify-center print:w-8 print:h-8">
            <span className="text-blue-600 font-bold text-xs sm:text-sm print:text-xs">JD</span>
          </div>
        </div>
        <h1 className="text-base sm:text-lg font-bold mb-1 print:text-lg print:text-gray-800">JD Agro & Earthmovers BILL</h1>
        <p className="text-xs sm:text-sm text-blue-100 print:text-gray-600">Professional Agro & Earthmovers Rental Services</p>
        <div className="mt-1 sm:mt-2 text-xs text-blue-100 print:text-gray-500">
          <p>Tuljapur, Dist- Dharashiv - 413601</p>
          <p>Phone: +91-7558379410 | Email: shubhamja3333@gmail.com</p>
        </div>
      </div>

      {/* Bill Details Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
        {/* Left Side - Bill To */}
        <div>
          <h2 className="text-xs sm:text-sm font-semibold mb-1 text-gray-800">Bill To:</h2>
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{bill.customer.name}</p>
            <p className="text-xs text-gray-600">{bill.customer.address || 'N/A'}</p>
            <p className="text-xs text-gray-600">Phone: {bill.customer.contactNumber}</p>
          </div>
        </div>

        {/* Right Side - Bill Info */}
        <div className="text-left sm:text-right">
          <div className="space-y-0.5">
            <p className="text-xs"><span className="font-semibold">Bill No:</span> {bill.billNumber}</p>
            <p className="text-xs"><span className="font-semibold">Date:</span> {formatDateDDMMYYYY(bill.createdAt)}</p>
            {bill.dueDate && <p className="text-xs"><span className="font-semibold">Due Date:</span> {formatDateDDMMYYYY(bill.dueDate)}</p>}
            <p className="text-xs"><span className="font-semibold">Operator:</span> {bill.rentals[0]?.operator.name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Enhanced Rental Details */}
      <div className="mb-2">
        <h2 className="text-sm sm:text-base font-bold mb-1 sm:mb-2 text-gray-800 border-b-2 border-blue-200 pb-1">Rental Details</h2>

        {/* Mobile Layout: Cards */}
        <div className="block sm:hidden space-y-4">
          {bill.rentals.map((rental, index) => (
            <div key={rental.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-800 mb-2">{getRentalDescription(rental)}</div>
              <div className="flex justify-between items-center text-sm">
                <div className="text-gray-600">
                  <div className="text-xs">
                    Rate: {rental.unitType === 'hourly' && rental.machineType === 'excavator' ?
                      `₹${rental.normalHourlyRate}/₹${rental.breakerHourlyRate}` :
                      `₹${rental.pricePerUnit.toLocaleString('en-IN')}`
                    }
                  </div>
                  {rental.unitType === 'hourly' && rental.machineType === 'excavator' && (
                    <div className="text-xs mt-1">
                      Hours: {(() => {
                        const normalSlots = rental.timeSlots?.filter(slot => !slot.isBreaker) || [];
                        const normalHours = normalSlots.length > 0 ? normalSlots.reduce((sum, slot) => {
                          const hours = slot.calculatedAmount ? slot.calculatedAmount / (rental.normalHourlyRate || 1) : calculateHours(slot.startTime, slot.endTime);
                          return sum + hours;
                        }, 0) : 0;
                        return normalHours.toFixed(2);
                      })()} hrs (Normal), {(() => {
                        const breakerSlots = rental.timeSlots?.filter(slot => slot.isBreaker) || [];
                        const breakerHours = breakerSlots.length > 0 ? breakerSlots.reduce((sum, slot) => {
                          const hours = slot.calculatedAmount ? slot.calculatedAmount / (rental.breakerHourlyRate || 1) : calculateHours(slot.startTime, slot.endTime);
                          return sum + hours;
                        }, 0) : 0;
                        return breakerHours.toFixed(2);
                      })()} hrs (Breaker)
                    </div>
                  )}
                  {!(rental.unitType === 'hourly' && rental.machineType === 'excavator') && (
                    <div className="text-xs">
                      Quantity: {rental.quantity} {rental.unitType}
                    </div>
                  )}
                </div>
                <div className="font-bold text-gray-900">{formatCurrency(rental.totalAmount)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Layout: Table */}
        <div className="hidden sm:block border-2 border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full table-fixed min-w-[600px]">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold text-gray-800 border-b-2 border-gray-200 uppercase tracking-wide w-1/3">Description</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold text-gray-800 border-b-2 border-gray-200 uppercase tracking-wide w-1/6">Time Slot</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold text-gray-800 border-b-2 border-gray-200 uppercase tracking-wide w-1/6">Quantity</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold text-gray-800 border-b-2 border-gray-200 uppercase tracking-wide w-1/6">Rate</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold text-gray-800 border-b-2 border-gray-200 uppercase tracking-wide w-1/6">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.rentals.map((rental, index) => {
                if (rental.unitType === 'hourly' && rental.machineType === 'excavator') {
                  const normalSlots = rental.timeSlots?.filter(slot => !slot.isBreaker) || [];
                  const normalHours = normalSlots.length > 0 ? normalSlots.reduce((sum, slot) => {
                    const hours = slot.calculatedAmount ? slot.calculatedAmount / (rental.normalHourlyRate || 1) : calculateHours(slot.startTime, slot.endTime);
                    return sum + hours;
                  }, 0) : 0;
                  const normalAmount = normalHours * (rental.normalHourlyRate || 0);

                  const breakerSlots = rental.timeSlots?.filter(slot => slot.isBreaker) || [];
                  const breakerHours = breakerSlots.length > 0 ? breakerSlots.reduce((sum, slot) => {
                    const hours = slot.calculatedAmount ? slot.calculatedAmount / (rental.breakerHourlyRate || 1) : calculateHours(slot.startTime, slot.endTime);
                    return sum + hours;
                  }, 0) : 0;
                  const breakerAmount = breakerHours * (rental.breakerHourlyRate || 0);

                  return (
                    <React.Fragment key={rental.id}>
                      {normalHours > 0 && (
                        <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'} hover:bg-blue-25 transition-colors duration-150`}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-800 border-b border-gray-100 font-medium">
                            JCB (Normal){rental.description ? ` (${rental.description})` : ''}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            {normalSlots.map((slot, idx) => (
                              <div key={idx} className="text-xs">
                                {slot.startTime} - {slot.endTime}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            {normalHours.toFixed(2)} hrs
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            ₹{rental.normalHourlyRate?.toLocaleString('en-IN') || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center font-bold text-gray-900 border-b border-gray-100">
                            {formatCurrency(normalAmount)}
                          </td>
                        </tr>
                      )}
                      {breakerHours > 0 && (
                        <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'} hover:bg-blue-25 transition-colors duration-150`}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-800 border-b border-gray-100 font-medium">
                            JCB (Breaker){rental.description ? ` (${rental.description})` : ''}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            {breakerSlots.map((slot, idx) => (
                              <div key={idx} className="text-xs">
                                {slot.startTime} - {slot.endTime}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            {breakerHours.toFixed(2)} hrs
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center text-gray-800 border-b border-gray-100 font-medium">
                            ₹{rental.breakerHourlyRate?.toLocaleString('en-IN') || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-center font-bold text-gray-900 border-b border-gray-100">
                            {formatCurrency(breakerAmount)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                } else {
                  return (
                    <tr key={rental.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'} hover:bg-blue-25 transition-colors duration-150`}>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-gray-800 border-b border-gray-100 font-medium">
                        {getRentalDescription(rental)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-center text-gray-800 border-b border-gray-100 font-medium">
                        N/A
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-center text-gray-800 border-b border-gray-100 font-medium">
                        {`${rental.quantity} ${rental.unitType}`}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-center text-gray-800 border-b border-gray-100 font-medium">
                        ₹{rental.pricePerUnit.toLocaleString('en-IN')}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs text-center font-bold text-gray-900 border-b border-gray-100">
                        {formatCurrency(rental.totalAmount)}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Summary Section */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 border-b-2 border-blue-200 pb-2">Payment Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Total Amount Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-3 sm:p-4 rounded-xl border-2 border-emerald-200 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm sm:text-base font-bold text-emerald-800">Total Amount</p>
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">₹</span>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700">{formatCurrency(bill.totalAmount)}</p>
          </div>

          {/* Total Paid Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4 rounded-xl border-2 border-blue-200 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm sm:text-base font-bold text-blue-800">Total Paid</p>
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">✓</span>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-700">{formatCurrency(totalPaid)}</p>
          </div>

          {/* Balance Due Card */}
          <div className={`p-3 sm:p-4 rounded-xl border-2 shadow-lg ${balanceDue > 0 ? 'bg-gradient-to-br from-red-50 to-pink-100 border-red-200' : 'bg-gradient-to-br from-gray-50 to-slate-100 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-sm sm:text-base font-bold ${balanceDue > 0 ? 'text-red-800' : 'text-gray-800'}`}>Balance Due</p>
              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${balanceDue > 0 ? 'bg-red-500' : 'bg-gray-500'}`}>
                <span className="text-white font-bold text-xs">{balanceDue > 0 ? '!' : '✓'}</span>
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${balanceDue > 0 ? 'text-red-700' : 'text-gray-700'}`}>{formatCurrency(balanceDue)}</p>
          </div>
        </div>

        {/* Payment History */}
        <div className="mt-3 sm:mt-4">
          <h3 className="text-sm sm:text-base font-bold mb-1 sm:mb-2 text-gray-800">Payment History</h3>
          <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="max-h-28 sm:max-h-32 overflow-y-auto">
              {getAllPayments().length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {getAllPayments().map((payment, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-2 sm:space-x-3 mb-1 sm:mb-0">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span className="text-xs font-medium text-gray-700">{formatDateDDMMYYYY(payment.date)}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{payment.mode}</span>
                      </div>
                      <span className="text-sm sm:text-base font-bold text-gray-900">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 sm:px-4 py-4 sm:py-6 text-center">
                  <p className="text-gray-500 italic text-sm">No payments recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mb-4 border-t border-gray-300 pt-2">
        <p className="text-sm text-gray-700">Thank you for your business!</p>
        <p className="text-xs text-gray-600">For any queries, please contact us.</p>
      </div>

      {/* Language Selector */}
      <div className="flex justify-center mb-4 print:hidden">
        <div className="bg-gray-100 p-3 rounded-lg">
          <label className="text-sm font-medium text-gray-700 mr-3">Select Language:</label>
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedLanguage('english')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                selectedLanguage === 'english'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('marathi')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                selectedLanguage === 'marathi'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              मराठी
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Professional Buttons */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 print:hidden mt-4">
        {/* <button
          onClick={onPrint}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <span>🖨️</span>
          Print Bill
        </button> */}
        <button
          onClick={shareBillOnWhatsApp}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <span>📱</span>
          Share on WhatsApp
        </button>
        <button
          onClick={shareBillAsImageOnWhatsApp}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <span>📸</span>
          Share as Image
        </button>
        <button
          onClick={onClose}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <span>✕</span>
          Close
        </button>
      </div>
    </div>
  )
}

export default BillComponent
