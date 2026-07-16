import { DistrictRepository } from '../repositories/district.repository';
import { StateRepository } from '../repositories/state.repository';
import { IDistrict } from '../interfaces/district.interface';
import { AppError } from '../middlewares/errorHandler';
import httpStatus from 'http-status';

export class DistrictService {
  private repository: DistrictRepository;
  private stateRepository: StateRepository;

  constructor() {
    this.repository = new DistrictRepository();
    this.stateRepository = new StateRepository();
  }

  async create(data: IDistrict) {
    const state = await this.stateRepository.findById(data.state.toString());
    if (!state) {
      throw new AppError('Referenced state not found', httpStatus.BAD_REQUEST);
    }

    const exists = await this.repository.existsByCode(data.code);
    if (exists) {
      throw new AppError(`District with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
    }

    return this.repository.create(data);
  }

  async getById(id: string) {
    const district = await this.repository.findById(id);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return district;
  }

  async getByCode(code: string) {
    const district = await this.repository.findByCode(code);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return district;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getByState(stateId: string) {
    const state = await this.stateRepository.findById(stateId);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByState(stateId);
  }

  async update(id: string, data: Partial<IDistrict>) {
    const district = await this.repository.findById(id);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }

    if (data.code) {
      const duplicate = await this.repository.existsByCode(data.code, id);
      if (duplicate) {
        throw new AppError(`District with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
      }
    }

    if (data.state) {
      const state = await this.stateRepository.findById(data.state.toString());
      if (!state) {
        throw new AppError('Referenced state not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async delete(id: string) {
    const district = await this.repository.findById(id);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const district = await this.repository.findById(id);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }

  async restore(id: string) {
    const district = await this.repository.findById(id);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: true });
  }
}
