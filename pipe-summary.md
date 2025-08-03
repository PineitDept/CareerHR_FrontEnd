# 🔧 RxJS Pipe Operators - Complete Guide

## 📚 **Introduction**
Pipe operators เป็นเครื่องมือสำหรับแปลง กรอง และจัดการข้อมูลใน Observable streams

**เปรียบเทียบ:** เหมือนสายการผลิตในโรงงาน - ข้อมูลเข้าไป ผ่านเครื่องจักรหลายตัว ออกมาเป็นผลิตภัณฑ์สำเร็จ

---

## 🏗️ **Transformation Operators (แปลงข้อมูล)**

### **`map` - แปลงข้อมูลทีละตัว**
**ใช้เมื่อ:** ต้องการแปลงข้อมูลแต่ละตัวในรูปแบบเดียวกัน

```typescript
// เปลี่ยนตัวเลขเป็นสองเท่า
const numbers$ = of(1, 2, 3, 4);
numbers$.pipe(
  map(x => x * 2)
).subscribe(console.log);
// Output: 2, 4, 6, 8

// ตัวอย่างจริง: แปลง API response
this.userService.getUsers().pipe(
  map(users => users.map(user => ({
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    isActive: user.status === 'active'
  })))
);
```

### **`switchMap` - แปลงเป็น Observable ใหม่ และ cancel อันเก่า**
**ใช้เมื่อ:** การค้นหา, เปลี่ยนหน้า, ต้องการ cancel request เก่าเมื่อมีใหม่

```typescript
// การค้นหาที่ cancel อันเก่าอัตโนมัติ
searchInput$.pipe(
  debounceTime(300),
  switchMap(searchTerm => 
    this.apiService.search(searchTerm) // ถ้ามีการค้นหาใหม่ จะ cancel อันเก่า
  )
).subscribe(results => this.showResults(results));

// Tab change (ในโค้ดของเรา)
this.tabChangeSubject.pipe(
  switchMap(tab => this.fetchDataForTab(tab)) // เปลี่ยน tab ใหม่ = cancel การโหลดเก่า
)
```

### **`mergeMap` - แปลงเป็น Observable ใหม่ แต่ไม่ cancel อันเก่า**
**ใช้เมื่อ:** ต้องการให้ทุก request ทำงานแบบ parallel

```typescript
// Save หลายไฟล์พร้อมกัน
files$.pipe(
  mergeMap(file => this.uploadFile(file)) // ทุกไฟล์ upload พร้อมกัน
).subscribe(result => console.log('File uploaded:', result));
```

### **`concatMap` - แปลงเป็น Observable ใหม่ แต่รอคิวตามลำดับ**
**ใช้เมื่อ:** ต้องการให้ทำงานทีละอัน เป็นลำดับ

```typescript
// บันทึกข้อมูลตามลำดับ
actions$.pipe(
  concatMap(action => this.saveAction(action)) // รอ action แรกเสร็จก่อน ค่อยทำอันต่อไป
).subscribe();
```

---

## 🔍 **Filtering Operators (กรองข้อมูล)**

### **`filter` - กรองข้อมูลตามเงื่อนไข**
**ใช้เมื่อ:** ต้องการเฉพาะข้อมูลที่ผ่านเงื่อนไข

```typescript
// กรองเฉพาะเลขคู่
numbers$.pipe(
  filter(x => x % 2 === 0)
).subscribe(console.log);
// Input: 1,2,3,4,5,6 → Output: 2,4,6

// ตัวอย่างจริง: กรองเฉพาะ user ที่ active
users$.pipe(
  filter(users => users.length > 0),
  map(users => users.filter(user => user.isActive))
);
```

### **`distinctUntilChanged` - กรองข้อมูลซ้ำ**
**ใช้เมื่อ:** ไม่ต้องการให้ทำงานซ้ำถ้าข้อมูลเดิม

```typescript
// ป้องกันการเรียก API ซ้ำ
this.searchSubject.pipe(
  distinctUntilChanged(), // ถ้าค้นหาคำเดิม จะไม่ทำงาน
  switchMap(term => this.search(term))
);

// ใช้กับ object
this.filterSubject.pipe(
  distinctUntilChanged((prev, curr) => 
    JSON.stringify(prev) === JSON.stringify(curr)
  )
);
```

### **`take` - เอาแค่จำนวนที่กำหนด**
**ใช้เมื่อ:** ต้องการจำกัดจำนวนข้อมูล

```typescript
// เอาแค่ 3 ตัวแรก
stream$.pipe(
  take(3)
).subscribe(); // จะ unsubscribe อัตโนมัติหลังได้ 3 ตัว

// ตัวอย่างจริง: เอาแค่ผลลัพธ์แรก
this.userService.getCurrentUser().pipe(
  take(1) // เอาแค่ครั้งแรก แล้วหยุด
);
```

### **`skip` - ข้ามจำนวนที่กำหนด**
**ใช้เมื่อ:** ต้องการข้ามข้อมูลแรกๆ

```typescript
// ข้าม 2 ตัวแรก
stream$.pipe(
  skip(2) // ข้าม index 0,1 เริ่มจาก index 2
);
```

---

## ⏱️ **Time-based Operators (จัดการเวลา)**

### **`debounceTime` - รอจนหยุดส่งข้อมูลตามเวลาที่กำหนด**
**ใช้เมื่อ:** การค้นหา, ป้องกันการส่ง request บ่อยเกินไป

```typescript
// รอ 300ms หลังจากหยุดพิมพ์
searchInput$.pipe(
  debounceTime(300), // รอ 300ms หลังจากหยุดพิมพ์
  switchMap(term => this.search(term))
);

// ป้องกันการคลิกปุ่มบ่อยเกินไป
button$.pipe(
  debounceTime(1000), // ห้ามคลิกซ้ำใน 1 วินาที
  tap(() => this.saveData())
);
```

### **`throttleTime` - จำกัดความถี่ตามเวลา**
**ใช้เมื่อ:** การ scroll, resize window

```typescript
// ทำงานทุก 100ms เท่านั้น
scroll$.pipe(
  throttleTime(100), // ทำงานสูงสุดทุก 100ms
  tap(() => this.handleScroll())
);
```

### **`delay` - หน่วงเวลา**
**ใช้เมื่อ:** ต้องการหน่วงเวลาก่อนทำงาน

```typescript
// หน่วง 1 วินาทีก่อนแสดงผล
data$.pipe(
  delay(1000),
  tap(data => this.showData(data))
);
```

---

## 🔄 **Utility Operators (เครื่องมือช่วย)**

### **`tap` - ทำงานข้างเคียงโดยไม่เปลี่ยนข้อมูล**
**ใช้เมื่อ:** Debugging, logging, side effects

```typescript
// ดูข้อมูลระหว่างทาง
data$.pipe(
  tap(data => console.log('Before transformation:', data)),
  map(data => transform(data)),
  tap(data => console.log('After transformation:', data)),
  tap(() => this.showLoading(false)) // หยุด loading
);
```

### **`catchError` - จัดการ error**
**ใช้เมื่อ:** ต้องการจัดการ error ไม่ให้ stream หยุดทำงาน

```typescript
// จัดการ error
this.apiService.getData().pipe(
  catchError(error => {
    console.error('API Error:', error);
    this.showErrorMessage('เกิดข้อผิดพลาด');
    return of([]); // ส่งค่าเริ่มต้นแทน
  })
);

// Retry เมื่อ error
this.apiService.getData().pipe(
  retry(3), // ลองใหม่ 3 ครั้ง
  catchError(error => {
    return throwError(error); // ถ้ายังไม่ได้ให้ throw error
  })
);
```

### **`finalize` - ทำงานเมื่อ stream จบ (สำเร็จหรือ error)**
**ใช้เมื่อ:** Cleanup, หยุด loading

```typescript
this.apiService.getData().pipe(
  tap(() => this.showLoading(true)),
  finalize(() => this.showLoading(false)) // ทำงานเสมอ ไม่ว่าสำเร็จหรือ error
);
```

---

## 🔗 **Combination Operators (รวมข้อมูล)**

### **`combineLatest` - รวมค่าล่าสุดจากหลาย Observable**
**ใช้เมื่อ:** ต้องการข้อมูลจากหลายแหล่งพร้อมกัน

```typescript
// รอให้ทั้งสองมีข้อมูล แล้วรวมกัน
combineLatest([
  this.searchTerm$,
  this.filters$,
  this.sortBy$
]).pipe(
  switchMap(([searchTerm, filters, sortBy]) =>
    this.fetchData({ searchTerm, filters, sortBy })
  )
);
```

### **`merge` - รวม Observable หลายตัวเป็นตัวเดียว**
**ใช้เมื่อ:** ต้องการฟังหลาย source พร้อมกัน

```typescript
// ฟังทั้งการคลิกและการกดคีย์บอร์ด
merge(
  fromEvent(button, 'click'),
  fromEvent(document, 'keydown').pipe(filter(e => e.key === 'Enter'))
).pipe(
  tap(() => this.submit())
);
```

---

## 📊 **Real-world Examples (ตัวอย่างการใช้งานจริง)**

### **1. Search with Debounce + Cancel**
```typescript
setupSearchStream() {
  this.searchInput$.pipe(
    debounceTime(300),           // รอ 300ms หลังหยุดพิมพ์
    distinctUntilChanged(),      // กรองคำค้นหาซ้ำ
    filter(term => term.length >= 2), // ค้นหาอย่างน้อย 2 ตัวอักษร
    tap(() => this.showLoading(true)), // แสดง loading
    switchMap(term =>            // Cancel การค้นหาเก่า
      this.apiService.search(term).pipe(
        catchError(error => {
          this.showError('Search failed');
          return of([]);
        })
      )
    ),
    finalize(() => this.showLoading(false)) // หยุด loading
  ).subscribe(results => {
    this.searchResults = results;
  });
}
```

### **2. Infinite Scroll**
```typescript
setupInfiniteScroll() {
  fromEvent(window, 'scroll').pipe(
    throttleTime(100),           // จำกัดความถี่ scroll
    filter(() => this.isNearBottom()), // กรองเฉพาะใกล้ก้นหน้า
    filter(() => !this.loading && this.hasMore), // กรองเฉพาะตอนไม่ loading
    tap(() => this.loading = true),
    switchMap(() =>
      this.loadMoreData().pipe(
        catchError(() => of([]))
      )
    ),
    finalize(() => this.loading = false)
  ).subscribe(newData => {
    this.data = [...this.data, ...newData];
  });
}
```

### **3. Form Validation**
```typescript
setupFormValidation() {
  combineLatest([
    this.email$.pipe(
      debounceTime(300),
      map(email => this.validateEmail(email))
    ),
    this.password$.pipe(
      map(password => this.validatePassword(password))
    )
  ]).pipe(
    map(([emailValid, passwordValid]) => emailValid && passwordValid),
    distinctUntilChanged()
  ).subscribe(isValid => {
    this.isFormValid = isValid;
  });
}
```

### **4. Auto-save**
```typescript
setupAutoSave() {
  this.formData$.pipe(
    debounceTime(2000),          // รอ 2 วินาทีหลังหยุดแก้ไข
    distinctUntilChanged(),      // บันทึกเฉพาะตอนมีการเปลี่ยนแปลง
    filter(data => this.isValidData(data)), // บันทึกเฉพาะข้อมูลที่ valid
    tap(() => this.showSaving(true)),
    switchMap(data =>
      this.saveData(data).pipe(
        catchError(error => {
          this.showError('Auto-save failed');
          return EMPTY;
        })
      )
    ),
    finalize(() => this.showSaving(false))
  ).subscribe(() => {
    this.showSuccess('Auto-saved');
  });
}
```

---

## 🎯 **Best Practices**

### **1. ลำดับ Operators**
```typescript
// ✅ ลำดับที่ดี
stream$.pipe(
  // 1. Filter/Transform ข้อมูลก่อน
  filter(data => data.isValid),
  map(data => data.value),
  distinctUntilChanged(),
  
  // 2. Time-based operations
  debounceTime(300),
  
  // 3. การแปลงเป็น Observable อื่น
  switchMap(value => this.apiCall(value)),
  
  // 4. Error handling
  catchError(error => of(defaultValue)),
  
  // 5. Side effects สุดท้าย
  tap(result => this.logResult(result)),
  finalize(() => this.cleanup())
);
```

### **2. Error Handling**
```typescript
// ✅ Handle error ที่ถูกจุด
this.dataService.getData().pipe(
  switchMap(data => 
    this.processData(data).pipe(
      catchError(error => {
        // Handle error ใน inner observable
        console.error('Process error:', error);
        return of(null); // ไม่ให้ outer stream หยุด
      })
    )
  ),
  catchError(error => {
    // Handle error ใน main stream
    console.error('Main error:', error);
    return throwError(error);
  })
);
```

### **3. Memory Management**
```typescript
// ✅ ใช้ takeUntilDestroyed สำหรับ Angular
setupStream() {
  this.dataSubject$.pipe(
    // ... operators
    takeUntilDestroyed(this.destroyRef) // Auto unsubscribe
  ).subscribe();
}
```

---

## 📝 **Quick Reference**

| Operator | Category | Use Case |
|----------|----------|----------|
| `map` | Transform | แปลงข้อมูลทีละตัว |
| `switchMap` | Transform | Cancel เก่า + สร้างใหม่ |
| `mergeMap` | Transform | Parallel operations |
| `concatMap` | Transform | Sequential operations |
| `filter` | Filter | กรองตามเงื่อนไข |
| `distinctUntilChanged` | Filter | กรองค่าซ้ำ |
| `debounceTime` | Time | รอจนหยุดส่งข้อมูล |
| `throttleTime` | Time | จำกัดความถี่ |
| `tap` | Utility | Side effects |
| `catchError` | Utility | จัดการ error |
| `finalize` | Utility | Cleanup |
| `combineLatest` | Combination | รวมค่าล่าสุด |
| `take` | Filter | จำกัดจำนวน |
| `retry` | Error | ลองใหม่เมื่อ error |

---

## 🎓 **เริ่มต้นเรียนรู้**

1. **เริ่มจาก Basic:** `map`, `filter`, `tap`
2. **เรียนรู้ Async:** `switchMap`, `mergeMap`
3. **จัดการเวลา:** `debounceTime`, `throttleTime`
4. **Error Handling:** `catchError`, `retry`
5. **Advanced:** `combineLatest`, `concatMap`

**คำแนะนำ:** ฝึกใช้ทีละตัว เข้าใจก่อน แล้วค่อยผสมกัน! 🚀