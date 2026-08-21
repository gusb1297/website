import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  AdminServiceError,
  createAdmin,
  deleteAdmin,
  listAdmins,
  updateAdmin,
} from '../services/adminService';

/** Translate a service error into a JSON response. */
function handleError(err: unknown, res: Response) {
  if (err instanceof AdminServiceError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error('[admins] Unexpected error:', err);
  return res.status(500).json({ error: 'server_error', message: 'সার্ভারে সমস্যা হয়েছে।' });
}

export const getAdmins = async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await listAdmins());
  } catch (err) {
    handleError(err, res);
  }
};

export const postAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await createAdmin(req.body);
    res.status(201).json(admin);
  } catch (err) {
    handleError(err, res);
  }
};

export const putAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await updateAdmin(req.params.id, req.body, req.user?.id);
    res.json(admin);
  } catch (err) {
    handleError(err, res);
  }
};

export const removeAdmin = async (req: AuthRequest, res: Response) => {
  try {
    await deleteAdmin(req.params.id, req.user?.id);
    res.json({ message: 'অ্যাডমিন অ্যাকাউন্ট মুছে ফেলা হয়েছে।' });
  } catch (err) {
    handleError(err, res);
  }
};
