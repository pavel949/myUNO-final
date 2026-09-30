import { redirect } from 'next/navigation';
/** All add-property entry points share the same guided submission process. */
export default function NewPropertyPage() { redirect('/property/onboard'); }
