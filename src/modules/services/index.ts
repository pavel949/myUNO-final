// module: services — public interface (see docs/14_tech_spec.md §3)
// Owns: Service, ServiceOrder, Provider, vetting
// Depends on: core, config, finance

export {
  createProviderApplication,
  getProviderApplications,
  approveProvider,
  rejectProvider,
  getProvider,
  getProviderForIdentity,
  type CreateProviderApplicationInput,
  type ApproveProviderInput,
  type RejectProviderInput,
} from './provider.service';

export {
  createServiceOrder,
  acceptServiceOrder,
  declineServiceOrder,
  fulfillServiceOrder,
  cancelServiceOrder,
  rateServiceOrder,
  getServiceOrder,
  getServiceOrdersByProvider,
  expireStaleServiceOrders,
  type CreateServiceOrderInput,
  type ServiceOrderDetails,
} from './service-order.service';

export {
  createService,
  getService,
  updateService,
  getServicesByProvider,
  listPublicServices,
  approveService,
  rejectService,
  getServiceAverageRating,
  type CreateServiceInput,
  type UpdateServiceInput,
} from './service.service';
