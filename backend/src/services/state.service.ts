import { StateRepository } from '../repositories/state.repository';
import { IState } from '../interfaces/state.interface';
import { AppError } from '../middlewares/errorHandler';
import httpStatus from 'http-status';

export class StateService {
  private repository: StateRepository;

  constructor() {
    this.repository = new StateRepository();
  }

  async create(data: IState) {
    const exists = await this.repository.existsByCode(data.code);
    if (exists) {
      throw new AppError(`State with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
    }

    return this.repository.create(data);
  }

  async getById(id: string) {
    const state = await this.repository.findById(id);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return state;
  }

  async getByCode(code: string) {
    const state = await this.repository.findByCode(code);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return state;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async update(id: string, data: Partial<IState>) {
    const state = await this.repository.findById(id);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }

    if (data.code) {
      const duplicate = await this.repository.existsByCode(data.code, id);
      if (duplicate) {
        throw new AppError(`State with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async delete(id: string) {
    const state = await this.repository.findById(id);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const state = await this.repository.findById(id);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }

  async restore(id: string) {
    const state = await this.repository.findById(id);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: true });
  }
}
