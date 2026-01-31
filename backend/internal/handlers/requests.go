package handlers

// SignUpRequest defines the structure for the /auth/signup request.
type SignUpRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Signature     string `json:"signature" binding:"required"` // Base64 encoded signature
}

// LoginRequest defines the structure for the /auth/login request.

type LoginRequest struct {

	WalletAddress string `json:"wallet_address" binding:"required"`

	Signature     string `json:"signature" binding:"required"` // Base64 encoded signature

}



// RegisterDeviceRequest defines the structure for the /iot/device/register request.



type RegisterDeviceRequest struct {



	DeviceType string `json:"device_type" binding:"required,oneof=esp32 raspi"`



	Location   string `json:"location" binding:"required"`



}







// RegisterNodeRequest defines the structure for the /network/node/register request.







type RegisterNodeRequest struct {







	Location string `json:"location" binding:"required"`







}















// CreateOrderRequest defines the structure for the /market/order/create request.







type CreateOrderRequest struct {







	Type       string  `json:"type" binding:"required,oneof=buy sell"`







	KwhAmount  float64 `json:"kwh_amount" binding:"required,gt=0"`







	TokenPrice float64 `json:"token_price" binding:"required,gt=0"`







}















// CancelOrderRequest defines the structure for the /market/order/cancel request.







type CancelOrderRequest struct {







	OrderID string `json:"order_id" binding:"required"`







}















// RefreshTokenRequest defines the structure for the /auth/refresh request.







type RefreshTokenRequest struct {







	RefreshToken string `json:"refresh_token" binding:"required"`







}




















