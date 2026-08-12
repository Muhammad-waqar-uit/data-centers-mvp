import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ───────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; displayName?: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  walletLogin: (data: { walletAddress: string; signature: string; message: string }) =>
    api.post("/auth/wallet-login", data),
  me: () => api.get("/auth/me"),
};

// ─── Data Centers ───────────────────────────────────
export const dataCentersApi = {
  list: (params?: { search?: string; country?: string; status?: string; page?: number; limit?: number }) =>
    api.get("/data-centers", { params }),
  get: (id: string) => api.get(`/data-centers/${id}`),
  create: (data: any) => api.post("/data-centers", data),
  update: (id: string, data: any) => api.put(`/data-centers/${id}`, data),
  geojson: () => api.get("/data-centers/geojson"),
};

// ─── Claims ─────────────────────────────────────────
export const claimsApi = {
  list: (params?: { dataCenterId?: string; factType?: string; status?: string; page?: number }) =>
    api.get("/claims", { params }),
  get: (id: string) => api.get(`/claims/${id}`),
  my: () => api.get("/claims/my"),
  pending: () => api.get("/claims/pending"),
  submit: (data: { dataCenterId: string; factType: string; factData: string; proofDocumentUrl?: string; proofHash?: string }) =>
    api.post("/claims", data),
  attest: (id: string, data?: { verifierWallet?: string }) =>
    api.post(`/claims/${id}/attest`, data),
  challenge: (id: string, data: { reason: string; challengerWallet?: string }) =>
    api.post(`/claims/${id}/challenge`, data),
};

// ─── Disputes ───────────────────────────────────────
export const disputesApi = {
  list: () => api.get("/disputes"),
  get: (id: string) => api.get(`/disputes/${id}`),
};

// ─── Map ────────────────────────────────────────────
export const mapApi = {
  geojson: () => api.get("/map/geojson"),
  stats: () => api.get("/map/stats"),
};

// ─── Staking ────────────────────────────────────────
export const stakingApi = {
  history: () => api.get("/staking/me/history"),
  stats: () => api.get("/staking/me/stats"),
};

// ─── Users ──────────────────────────────────────────
export const usersApi = {
  me: () => api.get("/users/me"),
  update: (data: any) => api.put("/users/me", data),
};
