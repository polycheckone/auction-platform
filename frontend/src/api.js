import axios from 'axios';

// W produkcji używa relative URL (/api), w dev - localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Export dla Socket.io - pusty string = same origin
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
});

// Flaga zapobiegająca wielokrotnym próbom odświeżenia
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor do dodawania tokenu
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor do obsługi błędów i automatycznego odświeżania tokenu
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Jeśli błąd 401 i token wygasł (nie dotyczy endpointów auth)
    if (error.response?.status === 401 &&
        error.response?.data?.code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/login')) {

      if (isRefreshing) {
        // Jeśli już odświeżamy, dodaj request do kolejki
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        isRefreshing = false;
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        // Zaktualizuj header dla oryginalnego requestu
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Inne błędy 401 (nieprawidłowy token, brak tokenu)
    if (error.response?.status === 401 &&
        !originalRequest.url?.includes('/auth/login')) {
      clearAuth();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// Funkcja pomocnicza do czyszczenia danych autoryzacji
const clearAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const activate = (token, password) => api.post('/auth/activate', { token, password });
export const getMe = () => api.get('/auth/me');
export const refreshAccessToken = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const logout = (refreshToken) => api.post('/auth/logout', { refreshToken });
export const logoutAll = () => api.post('/auth/logout-all');

// Materials & Categories
export const getCategories = () => api.get('/materials/categories');
export const getMaterials = (categoryId) => api.get('/materials', { params: { category_id: categoryId } });
export const getMaterial = (id) => api.get(`/materials/${id}`);
export const createCategory = (data) => api.post('/materials/categories', data);
export const createMaterial = (data) => api.post('/materials', data);
export const updateMaterial = (id, data) => api.put(`/materials/${id}`, data);
export const deleteMaterial = (id) => api.delete(`/materials/${id}`);

// Suppliers
export const getSuppliers = (params) => api.get('/suppliers', { params });
export const getSupplier = (id) => api.get(`/suppliers/${id}`);
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);
export const inviteSupplier = (id, data) => api.post(`/suppliers/${id}/invite`, data);
export const lookupNIP = (nip) => api.get(`/suppliers/lookup/nip/${nip}`);

// Auctions
export const getAuctions = (params) => api.get('/auctions', { params });
export const getAuction = (id) => api.get(`/auctions/${id}`);
export const createAuction = (data) => api.post('/auctions', data);
export const inviteToAuction = (id, data) => api.post(`/auctions/${id}/invite`, data);
export const removeFromAuction = (auctionId, supplierId) => api.delete(`/auctions/${auctionId}/invite/${supplierId}`);
export const startAuction = (id) => api.post(`/auctions/${id}/start`);
export const placeBid = (id, amount) => api.post(`/auctions/${id}/bid`, { amount });
export const cancelAuction = (id) => api.post(`/auctions/${id}/cancel`);
export const publishAuctionResults = (id) => api.post(`/auctions/${id}/publish-results`);
export const deleteAuction = (id) => api.delete(`/auctions/${id}`);

// Stats
export const getDashboardStats = () => api.get('/stats/dashboard');

export default api;
