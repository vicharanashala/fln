import { User } from '../models/user.model';
import { IUser } from '../interfaces/user.interface';

export class UserRepository {
  async create(data: Partial<IUser>) {
    const user = new User(data);
    return user.save();
  }

  async findByEmail(email: string) {
    return User.findOne({ email }).select('+password');
  }

  async findByUserId(userId: string) {
    return User.findOne({ userId });
  }
}
