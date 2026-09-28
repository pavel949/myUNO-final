/** Derived queue for each booking phase. Never persists an alternative stay
 * status: all buttons go back to the one canonical booking lifecycle. */
export type StayWorkDepartment='reservations'|'finance'|'front_desk'|'housekeeping'|'guest_care';
export type StayWorkPhase='request'|'payment'|'prearrival'|'arrival'|'in_house'|'checkout'|'close';
export interface StaySnapshot {
  id:string;projectId:string;unitId:string;unitName:string;
  guestName:string;status:string;startDate:string;endDate:string;
  totalSatang:number;paidSatang:number;refundAccruedSatang:number;
}
export interface StayWorkItem {
  id:string;bookingId:string;phase:StayWorkPhase;
  department:StayWorkDepartment;dueDate:string;actionKey:string;
  severity:'normal'|'attention';unitId:string;guestName:string;unitName:string;
}
export function deriveStayWorkItems(booking:StaySnapshot,today:string):StayWorkItem[]{
  const work:StayWorkItem[]=[];
  const add=(phase:StayWorkPhase,department:StayWorkDepartment,dueDate:string,actionKey:string,attention=false)=>{
    work.push({id:booking.id+':'+phase+':'+department,bookingId:booking.id,phase,department,dueDate,
      actionKey,severity:attention||dueDate<today?'attention':'normal',
      unitId:booking.unitId,guestName:booking.guestName,unitName:booking.unitName});
  };
  switch(booking.status){
    case'requested':add('request','reservations',today,'respond');break;
    case'pending_payment':add('payment','finance',today,'collect');break;
    case'confirmed':
      add('prearrival','front_desk',booking.startDate,'prearrival');
      add('prearrival','housekeeping',booking.startDate,'prepare_home');
      if(booking.startDate<=today)add('arrival','front_desk',booking.startDate,'check_in',booking.startDate<today);
      if(booking.totalSatang>booking.paidSatang)add('payment','finance',booking.startDate,'balance');
      break;
    case'checked_in':
      add('in_house','guest_care',today,'care');
      add('checkout','front_desk',booking.endDate,'check_out');
      add('checkout','housekeeping',booking.endDate,'turnover');
      break;
    case'checked_out':
      add('close','front_desk',booking.endDate,'inspect');
      if(booking.refundAccruedSatang>0)add('close','finance',booking.endDate,'refund');
      break;
    case'cancelled':
      if(booking.paidSatang>0 || booking.refundAccruedSatang>0)
        add('close','finance',today,'reconcile_cancelled',true);
      break;
  }
  return work;
}
export const stayWorkDepartments:StayWorkDepartment[]=[
  'reservations','finance','front_desk','housekeeping','guest_care',
];
