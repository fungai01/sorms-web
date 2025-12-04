# Các Cách Khác Để @PreAuthorize Hoạt Động (Không Cần Filter)

## Tổng Quan

Có **3 cách chính** để set Authentication vào SecurityContext mà không cần Filter:

1. **Spring AOP Aspect** - Intercept trước khi method được gọi
2. **HandlerInterceptor** - Intercept request trước khi đến controller
3. **Manual set trong Controller** - Set Authentication trong mỗi controller method (không khuyến nghị)

## 1. Spring AOP Aspect (Recommended)

### Cách Hoạt Động

**Aspect sẽ intercept TRƯỚC KHI @PreAuthorize được evaluate**, cho phép set Authentication vào SecurityContext.

### Implementation

**Tạo JWT Authentication Aspect:**

```java
package vn.edu.fpt.sorms.infrastructure.aspect;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vn.edu.fpt.sorms.application.service.auth.JWTProvider;

import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationAspect {

    private final JWTProvider jwtProvider;

    @Around("@within(org.springframework.security.access.prepost.PreAuthorize) || " +
           "@annotation(org.springframework.security.access.prepost.PreAuthorize)")
    public Object authenticateRequest(ProceedingJoinPoint joinPoint) throws Throwable {
        try {
            // 1. Extract token from request
            HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder
                    .currentRequestAttributes()).getRequest();
            
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("No Authorization header found, proceeding without authentication");
                return joinPoint.proceed();
            }

            String token = authHeader.substring(7);

            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);

            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            if (roles.isEmpty()) {
                log.warn("No roles found in token");
                return joinPoint.proceed();
            }

            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());

            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getJWTClaimsSet().getSubject(), // email
                    null,
                    authorities
            );

            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("Authentication set for user: {} with authorities: {}", 
                    signedJWT.getSubject(), authorities);

        } catch (Exception e) {
            log.error("Failed to authenticate request", e);
            // Continue without authentication - @PreAuthorize will handle authorization
        }

        // 7. Proceed with method execution
        return joinPoint.proceed();
    }

    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                        .filter(item -> item instanceof String)
                        .map(item -> (String) item)
                        .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Enable AspectJ trong config:**

```java
@Configuration
@EnableAspectJAutoProxy  // ✅ Enable AspectJ
public class AspectConfig {
    // ...
}
```

### Ưu Điểm:
- ✅ Không cần Filter
- ✅ Chỉ intercept methods có `@PreAuthorize`
- ✅ Tự động set Authentication trước khi @PreAuthorize evaluate
- ✅ Clean và dễ maintain

### Nhược Điểm:
- ❌ Vẫn cần Aspect (tương tự Filter)
- ❌ Phải enable AspectJ

## 2. HandlerInterceptor (Alternative)

### Cách Hoạt Động

**Interceptor intercept request TRƯỚC KHI đến controller**, cho phép set Authentication vào SecurityContext.

### Implementation

**Tạo JWT Authentication Interceptor:**

```java
package vn.edu.fpt.sorms.infrastructure.interceptor;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import vn.edu.fpt.sorms.application.service.auth.JWTProvider;

import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationInterceptor implements HandlerInterceptor {

    private final JWTProvider jwtProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        try {
            // 1. Extract token from request
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.debug("No Authorization header found");
                return true; // Continue without authentication
            }

            String token = authHeader.substring(7);

            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);

            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            if (roles.isEmpty()) {
                log.warn("No roles found in token");
                return true;
            }

            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());

            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getJWTClaimsSet().getSubject(), // email
                    null,
                    authorities
            );

            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("Authentication set for user: {} with authorities: {}", 
                    signedJWT.getSubject(), authorities);

        } catch (Exception e) {
            log.error("Failed to authenticate request", e);
            // Continue without authentication - @PreAuthorize will handle authorization
        }

        return true; // Continue request processing
    }

    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                        .filter(item -> item instanceof String)
                        .map(item -> (String) item)
                        .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Register Interceptor:**

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final JwtAuthenticationInterceptor jwtAuthenticationInterceptor;

    public WebMvcConfig(JwtAuthenticationInterceptor jwtAuthenticationInterceptor) {
        this.jwtAuthenticationInterceptor = jwtAuthenticationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(jwtAuthenticationInterceptor)
                .addPathPatterns("/**")  // Apply to all paths
                .excludePathPatterns("/auth/**", "/swagger-ui/**", "/v3/api-docs/**");  // Exclude public endpoints
    }
}
```

### Ưu Điểm:
- ✅ Không cần Filter
- ✅ Intercept tất cả requests
- ✅ Tự động set Authentication trước khi đến controller

### Nhược Điểm:
- ❌ Vẫn cần Interceptor (tương tự Filter)
- ❌ Phải register trong WebMvcConfig

## 3. Manual Set trong Controller (Không Khuyến Nghị)

### Cách Hoạt Động

**Set Authentication trong mỗi controller method** - Rất không khuyến nghị vì code duplication.

### Implementation

```java
@RestController
@RequestMapping("/rooms")
public class RoomController {

    private final JWTProvider jwtProvider;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<...> getAllRooms(HttpServletRequest request) {
        // Manual set Authentication
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
                List<String> roles = extractRoles(signedJWT);
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());
                
                Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getSubject(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                // Handle error
            }
        }
        
        // Continue with method logic
        // ...
    }
}
```

### Nhược Điểm:
- ❌ Code duplication (phải set trong mỗi method)
- ❌ Khó maintain
- ❌ Dễ quên set Authentication
- ❌ Không khuyến nghị

## 4. So Sánh Các Cách

| Cách | Ưu Điểm | Nhược Điểm | Khuyến Nghị |
|------|---------|------------|-------------|
| **Filter** | ✅ Standard Spring Security way<br>✅ Chạy sớm nhất trong chain<br>✅ Tự động cho tất cả requests | ❌ Cần thêm vào SecurityFilterChain | ⭐⭐⭐⭐⭐ |
| **Aspect** | ✅ Chỉ intercept methods có @PreAuthorize<br>✅ Clean và dễ maintain | ❌ Vẫn cần Aspect<br>❌ Phải enable AspectJ | ⭐⭐⭐⭐ |
| **Interceptor** | ✅ Intercept tất cả requests<br>✅ Tự động set Authentication | ❌ Vẫn cần Interceptor<br>❌ Phải register trong WebMvcConfig | ⭐⭐⭐⭐ |
| **Manual Set** | ❌ Không có | ❌ Code duplication<br>❌ Khó maintain | ⭐ |

## 5. Kết Luận

### Cách Tốt Nhất: **Filter** (Standard Spring Security Way)

**Lý do:**
- ✅ Standard Spring Security approach
- ✅ Chạy sớm nhất trong Security Filter Chain
- ✅ Tự động cho tất cả requests
- ✅ Dễ maintain và debug

### Cách Thay Thế: **Aspect** (Nếu Không Muốn Dùng Filter)

**Lý do:**
- ✅ Chỉ intercept methods có `@PreAuthorize`
- ✅ Clean và dễ maintain
- ✅ Không cần modify SecurityFilterChain

### Không Khuyến Nghị: **Manual Set**

**Lý do:**
- ❌ Code duplication
- ❌ Khó maintain
- ❌ Dễ quên set Authentication

## 6. Recommendation

**Nếu không muốn dùng Filter, hãy dùng Aspect:**

1. ✅ Tạo `JwtAuthenticationAspect`
2. ✅ Enable `@EnableAspectJAutoProxy`
3. ✅ Aspect sẽ tự động intercept methods có `@PreAuthorize`
4. ✅ Set Authentication vào SecurityContext trước khi @PreAuthorize evaluate

**Code sẽ clean và dễ maintain hơn Filter trong một số trường hợp.**


## Tổng Quan

Có **3 cách chính** để set Authentication vào SecurityContext mà không cần Filter:

1. **Spring AOP Aspect** - Intercept trước khi method được gọi
2. **HandlerInterceptor** - Intercept request trước khi đến controller
3. **Manual set trong Controller** - Set Authentication trong mỗi controller method (không khuyến nghị)

## 1. Spring AOP Aspect (Recommended)

### Cách Hoạt Động

**Aspect sẽ intercept TRƯỚC KHI @PreAuthorize được evaluate**, cho phép set Authentication vào SecurityContext.

### Implementation

**Tạo JWT Authentication Aspect:**

```java
package vn.edu.fpt.sorms.infrastructure.aspect;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vn.edu.fpt.sorms.application.service.auth.JWTProvider;

import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationAspect {

    private final JWTProvider jwtProvider;

    @Around("@within(org.springframework.security.access.prepost.PreAuthorize) || " +
           "@annotation(org.springframework.security.access.prepost.PreAuthorize)")
    public Object authenticateRequest(ProceedingJoinPoint joinPoint) throws Throwable {
        try {
            // 1. Extract token from request
            HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder
                    .currentRequestAttributes()).getRequest();
            
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("No Authorization header found, proceeding without authentication");
                return joinPoint.proceed();
            }

            String token = authHeader.substring(7);

            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);

            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            if (roles.isEmpty()) {
                log.warn("No roles found in token");
                return joinPoint.proceed();
            }

            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());

            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getJWTClaimsSet().getSubject(), // email
                    null,
                    authorities
            );

            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("Authentication set for user: {} with authorities: {}", 
                    signedJWT.getSubject(), authorities);

        } catch (Exception e) {
            log.error("Failed to authenticate request", e);
            // Continue without authentication - @PreAuthorize will handle authorization
        }

        // 7. Proceed with method execution
        return joinPoint.proceed();
    }

    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                        .filter(item -> item instanceof String)
                        .map(item -> (String) item)
                        .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Enable AspectJ trong config:**

```java
@Configuration
@EnableAspectJAutoProxy  // ✅ Enable AspectJ
public class AspectConfig {
    // ...
}
```

### Ưu Điểm:
- ✅ Không cần Filter
- ✅ Chỉ intercept methods có `@PreAuthorize`
- ✅ Tự động set Authentication trước khi @PreAuthorize evaluate
- ✅ Clean và dễ maintain

### Nhược Điểm:
- ❌ Vẫn cần Aspect (tương tự Filter)
- ❌ Phải enable AspectJ

## 2. HandlerInterceptor (Alternative)

### Cách Hoạt Động

**Interceptor intercept request TRƯỚC KHI đến controller**, cho phép set Authentication vào SecurityContext.

### Implementation

**Tạo JWT Authentication Interceptor:**

```java
package vn.edu.fpt.sorms.infrastructure.interceptor;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import vn.edu.fpt.sorms.application.service.auth.JWTProvider;

import java.text.ParseException;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationInterceptor implements HandlerInterceptor {

    private final JWTProvider jwtProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        try {
            // 1. Extract token from request
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.debug("No Authorization header found");
                return true; // Continue without authentication
            }

            String token = authHeader.substring(7);

            // 2. Verify token
            SignedJWT signedJWT = jwtProvider.verifyToken(token, false);

            // 3. Extract roles from token
            List<String> roles = extractRoles(signedJWT);
            if (roles.isEmpty()) {
                log.warn("No roles found in token");
                return true;
            }

            // 4. Map roles → authorities (uppercase, no ROLE_ prefix)
            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());

            // 5. Create Authentication object
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getJWTClaimsSet().getSubject(), // email
                    null,
                    authorities
            );

            // 6. Set Authentication into SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("Authentication set for user: {} with authorities: {}", 
                    signedJWT.getSubject(), authorities);

        } catch (Exception e) {
            log.error("Failed to authenticate request", e);
            // Continue without authentication - @PreAuthorize will handle authorization
        }

        return true; // Continue request processing
    }

    private List<String> extractRoles(SignedJWT jwt) {
        try {
            Object rolesClaim = jwt.getJWTClaimsSet().getClaim("roles");
            if (rolesClaim instanceof List<?>) {
                return ((List<?>) rolesClaim).stream()
                        .filter(item -> item instanceof String)
                        .map(item -> (String) item)
                        .collect(Collectors.toList());
            }
        } catch (ParseException e) {
            log.error("Failed to extract roles from token", e);
        }
        return Collections.emptyList();
    }
}
```

**Register Interceptor:**

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final JwtAuthenticationInterceptor jwtAuthenticationInterceptor;

    public WebMvcConfig(JwtAuthenticationInterceptor jwtAuthenticationInterceptor) {
        this.jwtAuthenticationInterceptor = jwtAuthenticationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(jwtAuthenticationInterceptor)
                .addPathPatterns("/**")  // Apply to all paths
                .excludePathPatterns("/auth/**", "/swagger-ui/**", "/v3/api-docs/**");  // Exclude public endpoints
    }
}
```

### Ưu Điểm:
- ✅ Không cần Filter
- ✅ Intercept tất cả requests
- ✅ Tự động set Authentication trước khi đến controller

### Nhược Điểm:
- ❌ Vẫn cần Interceptor (tương tự Filter)
- ❌ Phải register trong WebMvcConfig

## 3. Manual Set trong Controller (Không Khuyến Nghị)

### Cách Hoạt Động

**Set Authentication trong mỗi controller method** - Rất không khuyến nghị vì code duplication.

### Implementation

```java
@RestController
@RequestMapping("/rooms")
public class RoomController {

    private final JWTProvider jwtProvider;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<...> getAllRooms(HttpServletRequest request) {
        // Manual set Authentication
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                SignedJWT signedJWT = jwtProvider.verifyToken(token, false);
                List<String> roles = extractRoles(signedJWT);
                List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> role.toUpperCase())
                    .map(role -> new SimpleGrantedAuthority(role))
                    .collect(Collectors.toList());
                
                Authentication authentication = new UsernamePasswordAuthenticationToken(
                    signedJWT.getSubject(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                // Handle error
            }
        }
        
        // Continue with method logic
        // ...
    }
}
```

### Nhược Điểm:
- ❌ Code duplication (phải set trong mỗi method)
- ❌ Khó maintain
- ❌ Dễ quên set Authentication
- ❌ Không khuyến nghị

## 4. So Sánh Các Cách

| Cách | Ưu Điểm | Nhược Điểm | Khuyến Nghị |
|------|---------|------------|-------------|
| **Filter** | ✅ Standard Spring Security way<br>✅ Chạy sớm nhất trong chain<br>✅ Tự động cho tất cả requests | ❌ Cần thêm vào SecurityFilterChain | ⭐⭐⭐⭐⭐ |
| **Aspect** | ✅ Chỉ intercept methods có @PreAuthorize<br>✅ Clean và dễ maintain | ❌ Vẫn cần Aspect<br>❌ Phải enable AspectJ | ⭐⭐⭐⭐ |
| **Interceptor** | ✅ Intercept tất cả requests<br>✅ Tự động set Authentication | ❌ Vẫn cần Interceptor<br>❌ Phải register trong WebMvcConfig | ⭐⭐⭐⭐ |
| **Manual Set** | ❌ Không có | ❌ Code duplication<br>❌ Khó maintain | ⭐ |

## 5. Kết Luận

### Cách Tốt Nhất: **Filter** (Standard Spring Security Way)

**Lý do:**
- ✅ Standard Spring Security approach
- ✅ Chạy sớm nhất trong Security Filter Chain
- ✅ Tự động cho tất cả requests
- ✅ Dễ maintain và debug

### Cách Thay Thế: **Aspect** (Nếu Không Muốn Dùng Filter)

**Lý do:**
- ✅ Chỉ intercept methods có `@PreAuthorize`
- ✅ Clean và dễ maintain
- ✅ Không cần modify SecurityFilterChain

### Không Khuyến Nghị: **Manual Set**

**Lý do:**
- ❌ Code duplication
- ❌ Khó maintain
- ❌ Dễ quên set Authentication

## 6. Recommendation

**Nếu không muốn dùng Filter, hãy dùng Aspect:**

1. ✅ Tạo `JwtAuthenticationAspect`
2. ✅ Enable `@EnableAspectJAutoProxy`
3. ✅ Aspect sẽ tự động intercept methods có `@PreAuthorize`
4. ✅ Set Authentication vào SecurityContext trước khi @PreAuthorize evaluate

**Code sẽ clean và dễ maintain hơn Filter trong một số trường hợp.**

