import {
  serviceDTOSchema,
  type CreateServiceInput,
  type BarberDTO,
  type PublicServicesQuery,
  type ServiceDTO,
  type UpdateServiceInput,
} from '@navalha/contracts';
import {
  insertService,
  listActiveBarbers,
  listBarberServices as findBarberServices,
  listPublicServices as findPublicServices,
  updateServiceById,
} from './repository.js';

export class ServiceNotFoundError extends Error {}

export async function listBarbers(): Promise<BarberDTO[]> {
  return listActiveBarbers();
}

export async function listServices(filters: PublicServicesQuery): Promise<ServiceDTO[]> {
  const services = await findPublicServices(filters);
  return services.map(toServiceDTO);
}

export async function listManagedServices(): Promise<ServiceDTO[]> {
  const services = await findBarberServices();
  return services.map(toServiceDTO);
}

export async function createService(input: CreateServiceInput): Promise<ServiceDTO> {
  return toServiceDTO(await insertService(input));
}

export async function editService(
  id: string,
  input: UpdateServiceInput,
): Promise<ServiceDTO> {
  const service = await updateServiceById(id, input);
  if (!service) {
    throw new ServiceNotFoundError('Service not found.');
  }
  return toServiceDTO(service);
}

function toServiceDTO(service: {
  id: string;
  name: string;
  description: string;
  category: ServiceDTO['category'];
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  createdAt: Date;
}): ServiceDTO {
  return serviceDTOSchema.parse({ ...service, createdAt: service.createdAt.toISOString() });
}