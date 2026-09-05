package com.agritech.common;

import org.springframework.http.HttpStatus;

/** Thrown by services to produce the PRD 7.3 error envelope with a chosen status. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notFound(String what, String id) {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", what + " '" + id + "' does not exist");
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "validation_error", message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "forbidden", message);
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
