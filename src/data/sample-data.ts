export interface EmployeeRecord {
  employeeId: string
  name: string
  department: string
  office: string
  employmentType: 'Full-time' | 'Part-time' | 'Contract'
  status: 'Active' | 'On leave' | 'Probation'
  yearsAtCompany: number
}

export const employeeRecords: EmployeeRecord[] = [
  {
    employeeId: 'EMP-1042',
    name: 'Nguyen Minh Anh',
    department: 'Engineering',
    office: 'Ho Chi Minh City',
    employmentType: 'Full-time',
    status: 'Active',
    yearsAtCompany: 4.2,
  },
  {
    employeeId: 'EMP-1078',
    name: 'Tran Quoc Bao',
    department: 'Design',
    office: 'Da Nang',
    employmentType: 'Full-time',
    status: 'Active',
    yearsAtCompany: 2.5,
  },
  {
    employeeId: 'EMP-1091',
    name: 'Le Thu Ha',
    department: 'Customer Support',
    office: 'Hanoi',
    employmentType: 'Part-time',
    status: 'On leave',
    yearsAtCompany: 1.8,
  },
  {
    employeeId: 'EMP-1120',
    name: 'Pham Gia Huy',
    department: 'Engineering',
    office: 'Hanoi',
    employmentType: 'Contract',
    status: 'Probation',
    yearsAtCompany: 0.3,
  },
  {
    employeeId: 'EMP-1136',
    name: 'Vo Ngoc Lan',
    department: 'People Operations',
    office: 'Ho Chi Minh City',
    employmentType: 'Full-time',
    status: 'Active',
    yearsAtCompany: 6.1,
  },
  {
    employeeId: 'EMP-1164',
    name: 'Do Thanh Long',
    department: 'Finance',
    office: 'Da Nang',
    employmentType: 'Full-time',
    status: 'Active',
    yearsAtCompany: 3.4,
  },
  {
    employeeId: 'EMP-1182',
    name: 'Bui Phuong Mai',
    department: 'Design',
    office: 'Ho Chi Minh City',
    employmentType: 'Contract',
    status: 'Active',
    yearsAtCompany: 0.9,
  },
  {
    employeeId: 'EMP-1205',
    name: 'Dang Anh Tuan',
    department: 'Customer Support',
    office: 'Hanoi',
    employmentType: 'Full-time',
    status: 'On leave',
    yearsAtCompany: 5.7,
  },
  {
    employeeId: 'EMP-1231',
    name: 'Hoang Yen Nhi',
    department: 'Engineering',
    office: 'Da Nang',
    employmentType: 'Part-time',
    status: 'Active',
    yearsAtCompany: 1.1,
  },
  {
    employeeId: 'EMP-1259',
    name: 'Mai Duc Khang',
    department: 'Marketing',
    office: 'Ho Chi Minh City',
    employmentType: 'Full-time',
    status: 'Probation',
    yearsAtCompany: 0.2,
  },
  {
    employeeId: 'EMP-1288',
    name: 'Ly Khanh Vy',
    department: 'Finance',
    office: 'Hanoi',
    employmentType: 'Contract',
    status: 'Active',
    yearsAtCompany: 2.2,
  },
  {
    employeeId: 'EMP-1314',
    name: 'Vu Hoang Nam',
    department: 'Marketing',
    office: 'Da Nang',
    employmentType: 'Full-time',
    status: 'Active',
    yearsAtCompany: 7.3,
  },
]
