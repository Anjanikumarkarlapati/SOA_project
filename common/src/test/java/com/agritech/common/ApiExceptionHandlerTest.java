package com.agritech.common;

import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Set;

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
    void constraintViolationIs400() {
        var res = handler.handleConstraintViolation(new ConstraintViolationException("bad param", Set.of()));
        assertEquals(400, res.getStatusCode().value());
        assertEquals("validation_error", res.getBody().get("error"));
    }

    @Test
    void realFailureIsStill500() {
        assertEquals(500, handler.handleOther(new IllegalStateException("boom")).getStatusCode().value());
    }
}
