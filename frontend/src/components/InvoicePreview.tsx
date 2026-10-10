import { Box, Typography, Grid, Divider, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import StatusBadge from './StatusBadge';
import { formatDateTime, formatCurrency } from '../utils/format';
import { TAX_RATE } from '../constants';

export default function InvoicePreview({ sale, showDiscountDetails = true, onPrint }: { sale: any; showDiscountDetails?: boolean; onPrint?: () => void }) {
  const { subtotal, discountAmount, afterDiscount, taxAmount, grandTotal } = sale.billing || {};
  const { amountPaid, balance, status, method, transactionId, paidDate, paymentHistory } = sale.payment || {};
  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Invoice</Typography>
        <Typography variant="body2" color="text.secondary">{sale.customer?.name}</Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Bill Details</Typography>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Bill No.</Typography><Typography variant="body1">{sale.billNumber}</Typography></Box>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Date</Typography><Typography variant="body1">{formatDateTime(sale.billDate)}</Typography></Box>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Status</Typography><StatusBadge status={status} /></Box>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Created By</Typography><Typography variant="body1">{sale.advisor?.name || 'Advisor'}</Typography></Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Customer</Typography>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Name</Typography><Typography variant="body1">{sale.customer?.name}</Typography></Box>
            <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Phone</Typography><Typography variant="body1">{sale.customer?.phone}</Typography></Box>
            {sale.customer?.email && <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Email</Typography><Typography variant="body1">{sale.customer.email}</Typography></Box>}
            {sale.customer?.address && <Box sx={{ mb: 1 }}><Typography variant="body2" color="text.secondary">Address</Typography><Typography variant="body1">{sale.customer.address}</Typography></Box>}
          </Box>
        </Grid>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Items</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Tax</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(sale.items || []).map((item, i) => (
                <TableRow key={i} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.taxAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Subtotal</Typography>
          <Typography variant="body2" fontWeight={600}>{formatCurrency(subtotal)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Discount {showDiscountDetails && `(${sale.billing?.discountType} ${sale.billing?.discountValue}%)`}</Typography>
          <Typography variant="body2" fontWeight={600}>-{formatCurrency(discountAmount)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">After Discount</Typography>
          <Typography variant="body2" fontWeight={600}>{formatCurrency(afterDiscount)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Tax ({sale.billing?.taxRate || TAX_RATE}%)</Typography>
          <Typography variant="body2" fontWeight={600}>{formatCurrency(taxAmount)}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={700}>Grand Total</Typography>
          <Typography variant="h6" fontWeight={700}>{formatCurrency(grandTotal)}</Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payment</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
          <Typography variant="body1" fontWeight={600}>{formatCurrency(amountPaid)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Balance Due</Typography>
          <Typography variant="body1" fontWeight={600} color={balance > 0 ? 'warning.main' : 'success.main'}>
            {formatCurrency(balance)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Payment Method</Typography>
          <Typography variant="body1">{method || '—'}</Typography>
        </Box>
        {paidDate && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Paid On</Typography>
          <Typography variant="body1">{formatDateTime(paidDate)}</Typography>
        </Box>}
      </Box>
      {paymentHistory?.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payment History</Typography>
          {(paymentHistory || []).map((p, i) => (
            <Box key={i} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{p.method} — {p.paidBy}</Typography>
                <Typography variant="body1" fontWeight={600}>{formatCurrency(p.amount)}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">{formatDateTime(p.paidAt)}</Typography>
            </Box>
          ))}
        </>
      )}
      {sale.notes && <>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2">{sale.notes}</Typography>
      </>}
    </Box>
  );
}
