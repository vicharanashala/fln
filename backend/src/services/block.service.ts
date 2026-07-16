import { BlockRepository } from '../repositories/block.repository';
import { StateRepository } from '../repositories/state.repository';
import { DistrictRepository } from '../repositories/district.repository';
import { IBlock } from '../interfaces/block.interface';
import { AppError } from '../middlewares/errorHandler';
import httpStatus from 'http-status';

export class BlockService {
  private repository: BlockRepository;
  private stateRepository: StateRepository;
  private districtRepository: DistrictRepository;

  constructor() {
    this.repository = new BlockRepository();
    this.stateRepository = new StateRepository();
    this.districtRepository = new DistrictRepository();
  }

  async create(data: IBlock) {
    const state = await this.stateRepository.findById(data.state.toString());
    if (!state) {
      throw new AppError('Referenced state not found', httpStatus.BAD_REQUEST);
    }

    const district = await this.districtRepository.findById(data.district.toString());
    if (!district) {
      throw new AppError('Referenced district not found', httpStatus.BAD_REQUEST);
    }

    const exists = await this.repository.existsByCode(data.code);
    if (exists) {
      throw new AppError(`Block with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
    }

    return this.repository.create(data);
  }

  async getById(id: string) {
    const block = await this.repository.findById(id);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return block;
  }

  async getByCode(code: string) {
    const block = await this.repository.findByCode(code);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return block;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getByDistrict(districtId: string) {
    const district = await this.districtRepository.findById(districtId);
    if (!district) {
      throw new AppError('District not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByDistrict(districtId);
  }

  async getByState(stateId: string) {
    const state = await this.stateRepository.findById(stateId);
    if (!state) {
      throw new AppError('State not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByState(stateId);
  }

  async update(id: string, data: Partial<IBlock>) {
    const block = await this.repository.findById(id);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }

    if (data.code) {
      const duplicate = await this.repository.existsByCode(data.code, id);
      if (duplicate) {
        throw new AppError(`Block with code '${data.code.toUpperCase()}' already exists`, httpStatus.CONFLICT);
      }
    }

    if (data.state) {
      const state = await this.stateRepository.findById(data.state.toString());
      if (!state) {
        throw new AppError('Referenced state not found', httpStatus.BAD_REQUEST);
      }
    }

    if (data.district) {
      const district = await this.districtRepository.findById(data.district.toString());
      if (!district) {
        throw new AppError('Referenced district not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async delete(id: string) {
    const block = await this.repository.findById(id);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const block = await this.repository.findById(id);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }

  async restore(id: string) {
    const block = await this.repository.findById(id);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: true });
  }
}
