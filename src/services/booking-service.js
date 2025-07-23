const axios = require('axios');

const { BookingRepository } = require('../repository/index');
const { VACCINE_SERVICE_PATH } = require('../config/serverConfig');
const { ServiceError } = require('../utils/errors');

class BookingService {
    constructor() {
        this.bookingRepository = new BookingRepository();
    }

    async calculateTotalCost(vaccineId, noOfDoses) {
    const url = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}/inventories`;
    const response = await axios.get(url);
    const inventories = response.data.data;

    // Sort inventories by expiry date (soonest first)
    inventories.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    let remainingDoses = noOfDoses;
    let totalCost = 0;

    for (const inv of inventories) {
        if (remainingDoses <= 0) break;

        const available = inv.quantity;
        const usedFromThisBatch = Math.min(remainingDoses, available);

        totalCost += usedFromThisBatch * inv.price;
        remainingDoses -= usedFromThisBatch;
    }

    if (remainingDoses > 0) {
        throw new ServiceError(
            'Booking Failed',
            'Not enough total stock in all inventories'
        );
    }

    return totalCost;
}
    async createBooking(data) {
        try {
            const vaccineId = data.vaccineId;
            const getVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}`;
            const response = await axios.get(getVaccineRequestURL);
            const vaccineData = response.data.data;
            const priceOfTheVaccine = vaccineData.price;
            if (data.noOfDoses > vaccineData.quantity) {
                throw new ServiceError(
                    'Something went wrong in booking process',
                    'Insufficient quantity in the inventory'
                );
            }

            const totalCost = await this.calculateTotalCost(data.vaccineId, data.noOfDoses);
            const bookingPayload = { ...data, totalCost };

            const booking = await this.bookingRepository.create(bookingPayload);
            const updateVaccineRequestURL = `${VACCINE_SERVICE_PATH}/api/v1/vaccine/${vaccineId}/inventories`;
            await axios.patch(updateVaccineRequestURL, {
                quantity: data.noOfDoses
            });

            booking.status = 'Booked';
            await booking.save();

            return { ...booking.dataValues, totalCost };    

        } catch (error) {
            console.log(error);
            if (error.name === 'RepositoryError' || error.name === 'ValidationError') {
                throw error;
            }
            throw new ServiceError('Failed to process booking', error.message);
        }
    }


    
}

module.exports = BookingService;