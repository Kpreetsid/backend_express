import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsModel } from '../../models/comment.model';
import { WorkOrderModel } from '../../models/workOrder.model';
import { workOrderActivityService } from '../order/workOrderActivity.service';
import { commentService } from './comment.service';

vi.mock('../../models/comment.model', () => ({
  CommentsModel: {
    exists: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn()
  }
}));

vi.mock('../../models/workOrder.model', () => ({
  WorkOrderModel: {
    findOne: vi.fn()
  }
}));

vi.mock('../order/workOrderActivity.service', () => ({
  workOrderActivityService: {
    logActivity: vi.fn()
  }
}));

const queryResult = (value: unknown) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(value)
  })
});

describe('work-order comment tenant boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects creation when the work order is outside the authenticated tenant', async () => {
    vi.mocked(WorkOrderModel.findOne).mockReturnValue(queryResult(null) as never);

    await expect(commentService.createComment(
      { order_id: 'order-other', comments: 'Blocked' },
      'tenant-a',
      { _id: 'user-a' }
    )).rejects.toMatchObject({ status: 404, message: 'Work order not found' });

    expect(WorkOrderModel.findOne).toHaveBeenCalledWith({
      _id: 'order-other',
      account_id: 'tenant-a',
      visible: true
    });
  });

  it('pins comment updates to the authenticated tenant and parent work order', async () => {
    vi.mocked(CommentsModel.findOneAndUpdate).mockResolvedValue(null);

    await commentService.updateComment(
      'comment-a',
      'Updated',
      { _id: 'user-a' },
      'tenant-a',
      'order-a'
    );

    expect(CommentsModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'comment-a',
        account_id: 'tenant-a',
        order_id: 'order-a',
        visible: true
      },
      { comments: 'Updated', updatedBy: 'user-a' },
      { returnDocument: 'after' }
    );
  });

  it('pins recursive soft deletion to the same tenant and work order', async () => {
    const deleted = {
      _id: 'comment-a',
      account_id: 'tenant-a',
      order_id: 'order-a',
      comments: 'Removed'
    };
    vi.mocked(CommentsModel.findOneAndUpdate).mockResolvedValue(deleted as never);
    vi.mocked(CommentsModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([])
    } as never);

    await commentService.removeComment(
      'comment-a',
      { _id: 'user-a' },
      'tenant-a',
      'order-a'
    );

    expect(CommentsModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'comment-a',
        account_id: 'tenant-a',
        order_id: 'order-a',
        visible: true
      },
      { visible: false, updatedBy: 'user-a' },
      { returnDocument: 'after' }
    );
    expect(CommentsModel.find).toHaveBeenCalledWith({
      parentCommentId: 'comment-a',
      account_id: 'tenant-a',
      order_id: 'order-a',
      visible: true
    });
    expect(workOrderActivityService.logActivity).toHaveBeenCalledOnce();
  });
});
