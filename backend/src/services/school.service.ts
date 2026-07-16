import { SchoolRepository } from '../repositories/school.repository';
import { StateRepository } from '../repositories/state.repository';
import { DistrictRepository } from '../repositories/district.repository';
import { BlockRepository } from '../repositories/block.repository';
import { ISchool } from '../interfaces/school.interface';
import { AppError } from '../middlewares/errorHandler';
import httpStatus from 'http-status';

export class SchoolService {
  private repository: SchoolRepository;
  private stateRepository: StateRepository;
  private districtRepository: DistrictRepository;
  private blockRepository: BlockRepository;

  constructor() {
    this.repository = new SchoolRepository();
    this.stateRepository = new StateRepository();
    this.districtRepository = new DistrictRepository();
    this.blockRepository = new BlockRepository();
  }

  async create(data: ISchool) {
    const state = await this.stateRepository.findById(data.state.toString());
    if (!state) {
      throw new AppError('Referenced state not found', httpStatus.BAD_REQUEST);
    }

    const district = await this.districtRepository.findById(data.district.toString());
    if (!district) {
      throw new AppError('Referenced district not found', httpStatus.BAD_REQUEST);
    }

    const block = await this.blockRepository.findById(data.block.toString());
    if (!block) {
      throw new AppError('Referenced block not found', httpStatus.BAD_REQUEST);
    }

    const exists = await this.repository.existsByCode(data.code);
    if (exists) {
      throw new AppError(`School with code '${data.code.toLowerCase()}' already exists`, httpStatus.CONFLICT);
    }

    return this.repository.create(data);
  }

  async getById(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return school;
  }

  async getByCode(code: string) {
    const school = await this.repository.findByCode(code);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return school;
  }

  async getAll(includeInactive = false) {
    if (includeInactive) {
      return this.repository.findAll();
    }
    return this.repository.findActive();
  }

  async getByBlock(blockId: string) {
    const block = await this.blockRepository.findById(blockId);
    if (!block) {
      throw new AppError('Block not found', httpStatus.NOT_FOUND);
    }
    return this.repository.findByBlock(blockId);
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

  async update(id: string, data: Partial<ISchool>) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }

    if (data.code) {
      const duplicate = await this.repository.existsByCode(data.code, id);
      if (duplicate) {
        throw new AppError(`School with code '${data.code.toLowerCase()}' already exists`, httpStatus.CONFLICT);
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

    if (data.block) {
      const block = await this.blockRepository.findById(data.block.toString());
      if (!block) {
        throw new AppError('Referenced block not found', httpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return updated;
  }

  async delete(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    await this.repository.deleteById(id);
  }

  async softDelete(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.softDeleteById(id);
  }

  async restore(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.updateById(id, { isActive: true, isAccessLocked: false });
  }

  async lockAccess(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.lockAccess(id);
  }

  async unlockAccess(id: string) {
    const school = await this.repository.findById(id);
    if (!school) {
      throw new AppError('School not found', httpStatus.NOT_FOUND);
    }
    return this.repository.unlockAccess(id);
  }
}
