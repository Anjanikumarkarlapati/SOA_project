package com.agritech.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.cloud.gateway.config.GatewayProperties;
import org.springframework.cloud.gateway.filter.FilterDefinition;
import org.springframework.cloud.gateway.filter.factory.RetryGatewayFilterFactory;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpMethod;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketException;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** Verifies every API route places CircuitBreaker outside Retry and retries GET transport resets. */
class RouteRetryConfigTest {

    private static final Set<String> API_ROUTES = Set.of(
            "auth-service", "sensor-service", "crop-service",
            "climate-service", "recommendation-service", "irrigation-service");

    @Test
    void allApiRoutesRetryGetOnIoAndPrematureCloseInsideCircuitBreaker() throws Exception {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"));
        MutablePropertySources mps = new MutablePropertySources();
        sources.forEach(mps::addLast);

        GatewayProperties props = new Binder(
                org.springframework.boot.context.properties.source.ConfigurationPropertySources.from(mps))
                .bind("spring.cloud.gateway", Bindable.of(GatewayProperties.class))
                .get();

        List<String> checked = new java.util.ArrayList<>();
        for (var route : props.getRoutes()) {
            if (!API_ROUTES.contains(route.getId())) continue;
            checked.add(route.getId());

            List<FilterDefinition> filters = route.getFilters();
            int cbIdx = -1;
            int retryIdx = -1;
            for (int i = 0; i < filters.size(); i++) {
                if ("CircuitBreaker".equals(filters.get(i).getName())) cbIdx = i;
                if ("Retry".equals(filters.get(i).getName())) retryIdx = i;
            }
            assertTrue(cbIdx >= 0 && retryIdx > cbIdx,
                    route.getId() + " must declare CircuitBreaker before Retry");

            var args = filters.get(retryIdx).getArgs();
            assertEquals("2", args.get("retries"));
            assertEquals("GET", args.get("methods"));
            assertEquals("", args.get("series"));

            String[] exceptionNames = args.get("exceptions").split(",");
            assertEquals(2, exceptionNames.length);
            Class<?> ioEx = Class.forName(exceptionNames[0].trim());
            Class<?> prematureEx = Class.forName(exceptionNames[1].trim());
            assertEquals(IOException.class, ioEx);
            assertTrue(ioEx.isAssignableFrom(ConnectException.class));
            assertTrue(ioEx.isAssignableFrom(SocketException.class));
            assertEquals("reactor.netty.http.client.PrematureCloseException", prematureEx.getName());

            RetryGatewayFilterFactory.RetryConfig cfg = new RetryGatewayFilterFactory().newConfig();
            cfg.setRetries(Integer.parseInt(args.get("retries")));
            cfg.setMethods(HttpMethod.GET);
            @SuppressWarnings("unchecked")
            Class<? extends Throwable>[] classes = new Class[]{ioEx, prematureEx};
            cfg.setExceptions(classes);
            assertNotNull(new RetryGatewayFilterFactory().apply(cfg));
        }

        assertEquals(API_ROUTES, Set.copyOf(checked));
    }
}
