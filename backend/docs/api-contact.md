Auth
Đăng ký (Register)
    Endpoint: POST /api/auth/register

    Body:
    {
        "fullName": "string",
        "email": "string",
        "password": "string"
    }

    Response (201 - Thành công):
    {
        "_id": "string",
        "fullName": "string",
        "email": "string",
        "avatar": "string | null"
    }

    Nếu đăng ký thành công, server sẽ set cookie JWT cho client.

    Response lỗi (ví dụ):
        Trường không hợp lệ hoặc thiếu: 
        {
            "message": "Các trường không được bỏ trống!"
        }

        Email đã tồn tại:
        {
            "message": "Email đã được sử dụng!"
        }

Đăng nhập (Login)
    Endpoint: POST /api/auth/login

    Body: 
    {
        "email": "string",
        "password": "string"
    }
    Response (200 - Thành công):
    {
        "_id": "string",
        "fullName": "string",
        "email": "string",
        "avatar": "string | null"
    }

    Nếu đăng nhập thành công, server sẽ set cookie JWT cho client.

    Response lỗi (ví dụ):

    Email hoặc mật khẩu không đúng:
    {
        "message": "Email hoặc mật khẩu không đúng!"
    }