export interface ILoginRequest {
  emp_id: string;
  password: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ILogoutRequest {
  refreshToken: string;
}
