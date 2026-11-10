USE mediroute;

-- 1. JOIN: doctor directory with specialty information.
SELECT d.doctor_id,u.full_name AS doctor_name,s.name AS specialty,
       d.qualification,d.consultation_fee
FROM doctors d JOIN users u ON u.user_id=d.user_id
JOIN specialties s ON s.specialty_id=d.specialty_id
ORDER BY s.name,u.full_name;

-- 2. Nested subquery: doctors with above-average consultation fee.
SELECT d.doctor_id,u.full_name,d.consultation_fee
FROM doctors d JOIN users u ON u.user_id=d.user_id
WHERE d.consultation_fee>(SELECT AVG(d2.consultation_fee) FROM doctors d2);

-- 3. Correlated subquery: doctors with a future available slot.
SELECT d.doctor_id,u.full_name
FROM doctors d JOIN users u ON u.user_id=d.user_id
WHERE EXISTS(
 SELECT 1 FROM appointment_slots s
 WHERE s.doctor_id=d.doctor_id AND s.status='AVAILABLE'
 AND s.starts_at>UTC_TIMESTAMP()
);

-- 4. Correlated aggregate: doctors with more active bookings than the average.
SELECT d.doctor_id,u.full_name
FROM doctors d JOIN users u ON u.user_id=d.user_id
WHERE (SELECT COUNT(*) FROM appointments a
       WHERE a.doctor_id=d.doctor_id AND a.status IN('BOOKED','CONFIRMED'))
 > (SELECT AVG(booking_count) FROM (
      SELECT COUNT(a2.appointment_id) AS booking_count
      FROM doctors d2 LEFT JOIN appointments a2
       ON a2.doctor_id=d2.doctor_id AND a2.status IN('BOOKED','CONFIRMED')
      GROUP BY d2.doctor_id
    ) AS doctor_booking_totals);

-- 5. CTE: aggregate appointment counts by specialty.
WITH specialty_activity AS(
 SELECT s.specialty_id,s.name AS specialty,COUNT(a.appointment_id) AS appointment_count
 FROM specialties s LEFT JOIN doctors d ON d.specialty_id=s.specialty_id
 LEFT JOIN appointments a ON a.doctor_id=d.doctor_id
 GROUP BY s.specialty_id,s.name
)
SELECT specialty,appointment_count FROM specialty_activity
ORDER BY appointment_count DESC,specialty;

-- 6. Recursive CTE: generate the next 14 calendar days.
WITH RECURSIVE calendar_days AS(
 SELECT CURRENT_DATE() AS calendar_date,1 AS day_number
 UNION ALL
 SELECT DATE_ADD(calendar_date,INTERVAL 1 DAY),day_number+1
 FROM calendar_days WHERE day_number<14
)
SELECT c.calendar_date,COUNT(s.slot_id) AS available_slots
FROM calendar_days c LEFT JOIN appointment_slots s
 ON DATE(s.starts_at)=c.calendar_date AND s.status='AVAILABLE'
 AND s.starts_at>UTC_TIMESTAMP()
GROUP BY c.calendar_date,c.day_number ORDER BY c.day_number;

-- 7. Window function: rank doctors by consultation fee within specialty.
WITH ranked_doctors AS(
 SELECT s.name AS specialty,u.full_name AS doctor_name,d.consultation_fee,
 ROW_NUMBER() OVER(PARTITION BY s.specialty_id ORDER BY d.consultation_fee,d.doctor_id) AS fee_rank
 FROM doctors d JOIN users u ON u.user_id=d.user_id
 JOIN specialties s ON s.specialty_id=d.specialty_id
)
SELECT specialty,doctor_name,consultation_fee,fee_rank
FROM ranked_doctors ORDER BY specialty,fee_rank;

-- 8. View-based join: appointment details.
SELECT appointment_id,patient_name,doctor_name,specialty,starts_at,ends_at,status,urgency
FROM v_appointment_details ORDER BY starts_at DESC LIMIT 50;
