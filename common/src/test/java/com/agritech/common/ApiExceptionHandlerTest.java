package com.agritech.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Client mistakes must come back as 4xx, not the catch-all 500. */
class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void unknownPathIs404() {
        assertEquals(404, handler.handleOther(new NoResourceFoundException(HttpMethod.GET, "api/nope"))
                .getStatusCode().value());
    }

    @Test
    void wrongMethodIs405() {
        assertEquals(405, handler.handleOther(new HttpRequestMethodNotSupportedException("PATCH"))
                .getStatusCode().value());
    }

    @Test
    void realFailureIsStill500() {
        assertEquals(500, handler.handleOther(new IllegalStateException("boom")).getStatusCode().value());
    }
}
