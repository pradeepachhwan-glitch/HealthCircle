
export const fetchAvailableSlots = async (doctorId, date) => {
  const response = await fetch(`/api/scheduler/slots?doctorId=${doctorId}&date=${date}`);
  return response.json();
};

export const fetchAvailableSlots = async (doctorId, date) => {
  const response = await fetch(`/api/scheduler/slots?doctorId=${doctorId}&date=${date}`);
  return response.json();
};
