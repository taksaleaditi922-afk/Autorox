import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputAdornment, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Add, Close, EditOutlined, FilterList, PrintOutlined, Search } from '@mui/icons-material';
import { useAppDispatch } from '../../store/hooks';
import { showToast } from '../../redux/uiSlice';
import { invoiceFromCounterSale, openInvoicePrint } from '../../services/invoicePrintService';

export type CounterSale = {
  id: string; date: string; customerName: string; contactNumber: string;
  invoiceNumber: string | null; paymentStatus: 'PAID' | 'NOT_PAID';
  items: Array<{ name: string; qty: number; price: number }>; total: number;
};
const RED = '#bd0926';
const MOCK_SALES: CounterSale[] = [
  ['1','15/09/2026','Manmeet Singh','8825048214',null,'NOT_PAID','Engine oil',2800],
  ['2','15/09/2026','Manmeet Singh','9622263922',null,'NOT_PAID','Brake inspection',900],
  ['3','27/08/2026','Guransh Singh Suri','8080244774',null,'NOT_PAID','Wheel alignment',1200],
  ['4','14/08/2026','Vishnu Kumar','6362635517','S26-1769-0015','PAID','Periodic service',4500],
  ['5','09/08/2026','Priya Sharma','9876543210','S26-1769-0014','PAID','Battery replacement',6200],
  ['6','02/08/2026','Amit Verma','9811081240',null,'NOT_PAID','AC diagnosis',750],
  ['7','28/07/2026','Neha Kapoor','9988776655','S26-1769-0013','PAID','Tyre replacement',8200],
  ['8','21/07/2026','Rahul Mehta','9700012345','S26-1769-0012','PAID','Clutch service',6800],
  ['9','15/07/2026','Sneha Iyer','9845011223',null,'NOT_PAID','Interior cleaning',1500],
  ['10','06/07/2026','Arjun Rao','9000098765','S26-1769-0011','PAID','Brake pads and labour',4500],
  ['11','29/06/2026','Kavita Nair','9820345678','S26-1769-0010','PAID','Coolant flush',1800],
  ['12','18/06/2026','Rohan Das','9830012345',null,'NOT_PAID','Suspension check',1100],
].map((r) => ({ id:r[0], date:r[1], customerName:r[2], contactNumber:r[3], invoiceNumber:r[4], paymentStatus:r[5], items:[{ name:r[6], qty:1, price:r[7] }], total:r[7] } as CounterSale));
const currency = (n: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

export function SearchBar({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  return <TextField value={value} onChange={(e)=>onChange(e.target.value)} placeholder="Search by Customer name, Phone number" size="small" fullWidth inputProps={{'aria-label':'Search by customer name or contact number'}} InputProps={{startAdornment:<InputAdornment position="start"><Search fontSize="small"/></InputAdornment>}} sx={{maxWidth:470,'& .MuiOutlinedInput-root':{height:48,bgcolor:'#fff'}}}/>;
}

function Status({ value }: { value: CounterSale['paymentStatus'] }) {
  const paid=value==='PAID';
  return <Chip size="small" label={paid?'Paid':'Not Paid'} sx={{fontWeight:600,bgcolor:paid?'#ecfdf3':'#fff3f1',color:paid?'#147d36':'#d1242f',border:`1px solid ${paid?'#a6df81':'#ffaaa3'}`}}/>;
}

export function SaleRow({sale,onContinue,onEdit,onInvoice}:{sale:CounterSale;onContinue:(s:CounterSale)=>void;onEdit:(s:CounterSale)=>void;onInvoice:(s:CounterSale)=>void}) {
  const paid=sale.paymentStatus==='PAID';
  return <TableRow hover sx={{'& td':{borderColor:'#e8eaed',py:1.6}}}>
    <TableCell sx={{fontWeight:600,whiteSpace:'nowrap'}}>{sale.date}</TableCell>
    <TableCell><Stack direction="row" alignItems="center" spacing={1.5}><Avatar sx={{width:38,height:38,bgcolor:'#f5f6f8',color:'#34445a',border:'1px solid #d5dae1',fontWeight:700}}>{sale.customerName[0]}</Avatar><Typography variant="body2" fontWeight={700} sx={{textTransform:'uppercase',minWidth:150}}>{sale.customerName}</Typography></Stack></TableCell>
    <TableCell sx={{fontWeight:600}}>{sale.contactNumber}</TableCell><TableCell sx={{fontWeight:600,whiteSpace:'nowrap'}}>{sale.invoiceNumber??'N/A'}</TableCell><TableCell><Status value={sale.paymentStatus}/></TableCell>
    <TableCell sx={{minWidth:175}}><Button variant="contained" onClick={()=>paid?onInvoice(sale):onContinue(sale)} startIcon={paid?<PrintOutlined/>:undefined} sx={{bgcolor:paid?RED:'#15910b',minWidth:150,'&:hover':{bgcolor:paid?'#9f071f':'#117b09'}}}>{paid?'View Invoice':'Continue'}</Button></TableCell>
    <TableCell><Button variant="outlined" startIcon={<EditOutlined/>} onClick={()=>onEdit(sale)} sx={{color:'#64748b',borderColor:'#aab1bb'}}>Edit</Button></TableCell>
  </TableRow>;
}

export function SalesTable({sales,loading,error,onContinue,onEdit,onInvoice}:{sales:CounterSale[];loading:boolean;error:string|null;onContinue:(s:CounterSale)=>void;onEdit:(s:CounterSale)=>void;onInvoice:(s:CounterSale)=>void}) {
  return <TableContainer sx={{maxHeight:{lg:'70vh'},overflow:'auto',borderRadius:2}}><Table stickyHeader sx={{minWidth:1040}} aria-label="Counter sales history">
    <TableHead><TableRow>{['Date','Customer Name','Contact Number','Invoice Number','Payment','Action','Action'].map((x,i)=><TableCell key={x+i} sx={{bgcolor:'#f7f7f8',fontWeight:700,py:1.5}}>{x}</TableCell>)}</TableRow></TableHead>
    <TableBody>
      {loading&&<TableRow><TableCell colSpan={7} align="center" sx={{py:8}}><CircularProgress size={30}/><Typography mt={1}>Loading counter sales...</Typography></TableCell></TableRow>}
      {!loading&&error&&<TableRow><TableCell colSpan={7} sx={{py:5}}><Alert severity="error">{error}</Alert></TableCell></TableRow>}
      {!loading&&!error&&sales.map(s=><SaleRow key={s.id} sale={s} onContinue={onContinue} onEdit={onEdit} onInvoice={onInvoice}/>)}
      {!loading&&!error&&!sales.length&&<TableRow><TableCell colSpan={7} align="center" sx={{py:9,color:'text.secondary'}}>No counter sales found</TableCell></TableRow>}
    </TableBody>
  </Table></TableContainer>;
}

function Invoice({sale,onClose,onPrint}:{sale:CounterSale|null;onClose:()=>void;onPrint:(sale:CounterSale)=>void}) {
  return <Dialog open={!!sale} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle sx={{display:'flex',justifyContent:'space-between'}}>Invoice <IconButton onClick={onClose}><Close/></IconButton></DialogTitle><DialogContent dividers>{sale&&<Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Invoice number</Typography><Typography fontWeight={700}>{sale.invoiceNumber}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Date</Typography><Typography>{sale.date}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Customer</Typography><Typography>{sale.customerName} · {sale.contactNumber}</Typography></Stack><Divider/>{sale.items.map((x,i)=><Stack key={i} direction="row" justifyContent="space-between"><Typography>{x.name} × {x.qty}</Typography><Typography>{currency(x.qty*x.price)}</Typography></Stack>)}<Divider/><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Total</Typography><Typography variant="h6" fontWeight={800}>{currency(sale.total)}</Typography></Stack>
  </Stack>}</DialogContent><DialogActions><Button variant="contained" startIcon={<PrintOutlined/>} onClick={()=>sale&&onPrint(sale)} sx={{bgcolor:RED}}>Print invoice</Button></DialogActions></Dialog>;
}

export function CounterSalePage() {
  // API swap points: replace this state with GET /counter-sales, and replace saveSale
  // with create/update/payment mutations. The child components need no changes.
  const dispatch=useAppDispatch();
  const navigate=useNavigate();
  const [sales]=useState<CounterSale[]>(()=>{try{return [...JSON.parse(localStorage.getItem('autorox:counter-sales')||'[]'),...MOCK_SALES];}catch{return MOCK_SALES;}}); const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<'ALL'|'PAID'|'NOT_PAID'>('ALL');
  const [invoice,setInvoice]=useState<CounterSale|null>(null); const loading=false; const error:string|null=null;
  const visible=useMemo(()=>{const q=search.trim().toLowerCase();return sales.filter(s=>(filter==='ALL'||s.paymentStatus===filter)&&(!q||s.customerName.toLowerCase().includes(q)||s.contactNumber.includes(q)));},[sales,search,filter]);
  const printInvoice=(sale:CounterSale)=>{try{openInvoicePrint(invoiceFromCounterSale(sale));}catch(error){dispatch(showToast({severity:'error',message:error instanceof Error?error.message:'Could not open the invoice'}));}};
  return <Box><Typography variant="h4" fontWeight={800} mb={2.5}>Counter Sale</Typography><Paper elevation={0} sx={{border:'1px solid #e2e5e9',borderRadius:2.5,p:{xs:2,md:2.5},bgcolor:'#fff'}}>
    <Stack direction={{xs:'column',lg:'row'}} alignItems={{lg:'center'}} justifyContent="space-between" spacing={2} mb={2.5}><Typography variant="h5" color={RED} fontWeight={800}>Total {visible.length} Counter Sales</Typography><Stack direction={{xs:'column',sm:'row'}} spacing={1.5} sx={{flex:1,justifyContent:'flex-end'}}><SearchBar value={search} onChange={setSearch}/><FormControl size="small" sx={{minWidth:120}}><Select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} sx={{height:48}} startAdornment={<InputAdornment position="start"><FilterList/></InputAdornment>} inputProps={{'aria-label':'Payment status filter'}}><MenuItem value="ALL">All</MenuItem><MenuItem value="PAID">Paid</MenuItem><MenuItem value="NOT_PAID">Not Paid</MenuItem></Select></FormControl><Button variant="contained" startIcon={<Add/>} onClick={()=>navigate('/counter-sale/new')} sx={{minWidth:145,height:48,bgcolor:RED,'&:hover':{bgcolor:'#9f071f'}}}>Add New</Button></Stack></Stack>
    <SalesTable sales={visible} loading={loading} error={error} onContinue={counterSale=>navigate('/counter-sale/new',{state:{counterSale}})} onEdit={counterSale=>navigate('/counter-sale/new',{state:{counterSale}})} onInvoice={setInvoice}/>
  </Paper><Invoice sale={invoice} onClose={()=>setInvoice(null)} onPrint={printInvoice}/></Box>;
}
export default CounterSalePage;
