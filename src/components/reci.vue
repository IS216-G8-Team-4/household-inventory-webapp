<script>
import { supabase } from '@/lib/supabase.js'
import RecipeLoadingSkeleton from './RecipeLoadingSkeleton.vue';

export default {
    data() {
        return {
            session: null,
            householdId: null,
            inventory: [],
            expiringIngredients: [],
            recipes: [],
            filteredRecipes: [],
            initialising: true,
            loading: false,
            error: null,
            showHowItWorksModal: false,
            
            filters: {
                cuisine: '',
                maxTime: '',
                dietaryPreference: '',
                searchQuery: '',
                useExpiringOnly: false
            },
            
            cuisines: ['American', 'British', 'Canadian', 'Chinese', 'Croatian', 'Dutch', 
                      'Egyptian', 'French', 'Greek', 'Indian', 'Irish', 'Italian', 'Jamaican', 
                      'Japanese', 'Kenyan', 'Malaysian', 'Mexican', 'Moroccan', 'Polish', 
                      'Portuguese', 'Russian', 'Spanish', 'Thai', 'Tunisian', 'Turkish', 'Vietnamese'],
            
            dietaryOptions: ['Vegetarian', 'Vegan', 'Seafood', 'Beef', 'Chicken', 'Pork', 'Lamb'],
            
            selectedRecipe: null,
            
            showUseRecipeConfirmation: false,
            recipeToUse: null,
            ingredientsToDeduct: [],
            usingRecipe: false,
            
            showUndoNotification: false,
            undoTimer: null,
            lastDeduction: null,
            undoTimeRemaining: 15,
            
            showSuccessNotification: false,
            successMessage: '',
            successTimer: null
        }
    },

    components:{
        RecipeLoadingSkeleton
    },
    
    computed: {
        availableIngredients() {
            return this.inventory.map(item => item.name.toLowerCase())
        },
        
        expiringIngredientNames() {
            return this.expiringIngredients.map(item => item.name.toLowerCase())
        },
        
        recipesWithMatch() {
            return this.recipes.map(recipe => {
                const recipeIngredients = this.extractRecipeIngredients(recipe)
                const matchedIngredients = recipeIngredients.filter(ing => {
                    const recipeWords = ing.toLowerCase().trim().split(/\s+/);
                    return this.availableIngredients.some(avail => {
                        const inventoryWords = avail.toLowerCase().trim().split(/\s+/);
                        return recipeWords.every(word => inventoryWords.includes(word));
                    });
                })
                
                const expiringMatchedIngredients = matchedIngredients.filter(ing => {
                    const recipeWords = ing.toLowerCase().trim().split(/\s+/);
                    return this.expiringIngredientNames.some(expiring => {
                        const expiringWords = expiring.toLowerCase().trim().split(/\s+/);
                        return recipeWords.every(word => expiringWords.includes(word));
                    });
                })
                
                const matchPercentage = recipeIngredients.length > 0 
                    ? Math.round((matchedIngredients.length / recipeIngredients.length) * 100)
                    : 0
                
                const missingIngredients = recipeIngredients.filter(ing => 
                    !matchedIngredients.some(matched => matched === ing)
                )
                
                return {
                    ...recipe,
                    matchPercentage,
                    matchedIngredients,
                    expiringMatchedIngredients,
                    missingIngredients,
                    totalIngredients: recipeIngredients.length
                }
            }).sort((a, b) => {
                if (this.filters.useExpiringOnly) {
                    if (a.expiringMatchedIngredients.length !== b.expiringMatchedIngredients.length) {
                        return b.expiringMatchedIngredients.length - a.expiringMatchedIngredients.length
                    }
                }
                return b.matchPercentage - a.matchPercentage
            })
        },
        
        sortedRecipeIngredients() {
            if (!this.selectedRecipe) return []
            
            const recipeIngredients = this.extractRecipeIngredients(this.selectedRecipe)
            const ingredientsWithStatus = recipeIngredients.map((ingredient, index) => {
                const isAvailable = this.isIngredientAvailable(ingredient)
                const isExpiring = this.isIngredientExpiring(ingredient)
                const measure = this.getIngredientMeasure(this.selectedRecipe, index + 1)
                
                return {
                    name: ingredient,
                    measure: measure,
                    index: index,
                    isAvailable: isAvailable,
                    isExpiring: isExpiring,
                    sortOrder: isExpiring ? 0 : (isAvailable ? 1 : 2)
                }
            })
            
            return ingredientsWithStatus.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder
                }
                return a.name.localeCompare(b.name)
            })
        },
        
        undoProgressWidth() {
            return (this.undoTimeRemaining / 15) * 100
        }
    },
    
    methods: {
        async fetchSession() {
            try {
                const { data, error } = await supabase.auth.getSession()
                if (error) {
                    console.error('Error fetching session:', error)
                    return
                }
                this.session = data.session
            } catch (error) {
                console.error('Error in fetchSession:', error)
            }
        },

        showEmptyStateHelp() {
            this.showHowItWorksModal = true;
        },

        closeHowItWorksModal() {
            this.showHowItWorksModal = false;
        },

        async fetchHouseholdId() {
            if (!this.session) {
                console.warn('No session available')
                return
            }

            try {
                const userId = this.session.user.id
                const { data: households, error } = await supabase
                    .from('households')
                    .select('id')
                    .eq('created_by', userId)
                    .limit(1)

                if (error) {
                    console.error('Error fetching household:', error)
                    return
                }

                if (households.length > 0) {
                    this.householdId = households[0].id
                    console.log('Household ID fetched:', this.householdId)
                } else {
                    console.warn('No household found for user.')
                }
            } catch (error) {
                console.error('Error in fetchHouseholdId:', error)
            }
        },
        
        async fetchInventory() {
            if (!this.householdId) {
                console.warn('No household ID available for fetching inventory')
                return
            }

            try {
                console.log('Fetching inventory for household:', this.householdId)
                
                const { data, error } = await supabase
                    .from('ingredients')
                    .select(`
                        id,
                        name,
                        category,
                        unit,
                        ingredient_batches (
                            id,
                            quantity,
                            expiry_date,
                            status
                        )
                    `)
                    .eq('household_id', this.householdId)
                
                if (error) throw error
                
                this.inventory = data.map(ingredient => ({
                    id: ingredient.id,
                    name: ingredient.name,
                    category: ingredient.category,
                    unit: ingredient.unit,
                    batches: ingredient.ingredient_batches || []
                }))
                
                console.log('Fetched inventory:', this.inventory)
                console.log('Number of items:', this.inventory.length)
                
                if (this.inventory.length === 0) {
                    console.warn('No inventory items found! Check your household_id:', this.householdId)
                }
            } catch (error) {
                console.error('Error fetching inventory:', error)
                this.error = 'Failed to load inventory'
            }
        },
        
        async fetchExpiringIngredients() {
            if (!this.householdId) {
                console.warn('No household ID available for fetching expiring ingredients')
                return
            }

            try {
                const today = new Date().toISOString().split('T')[0]
                const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    .toISOString().split('T')[0]
                
                const { data, error } = await supabase
                    .from('ingredient_batches')
                    .select(`
                        id,
                        quantity,
                        expiry_date,
                        status,
                        ingredient:ingredients!inner (
                            id,
                            name,
                            category,
                            household_id
                        )
                    `)
                    .eq('ingredient.household_id', this.householdId)
                    .eq('status', 'active')
                    .gte('expiry_date', today)
                    .lte('expiry_date', sevenDaysFromNow)
                    .order('expiry_date', { ascending: true })
                
                if (error) throw error
                
                const uniqueIngredients = new Map()
                data.forEach(batch => {
                    if (batch.ingredient && !uniqueIngredients.has(batch.ingredient.id)) {
                        uniqueIngredients.set(batch.ingredient.id, {
                            id: batch.ingredient.id,
                            name: batch.ingredient.name,
                            category: batch.ingredient.category,
                            expiryDate: batch.expiry_date,
                            quantity: batch.quantity
                        })
                    }
                })
                
                this.expiringIngredients = Array.from(uniqueIngredients.values())
                console.log('Expiring ingredients:', this.expiringIngredients)
            } catch (error) {
                console.error('Error fetching expiring ingredients:', error)
            }
        },
        
        extractRecipeIngredients(recipe) {
            const ingredients = []
            for (let i = 1; i <= 20; i++) {
                const ingredient = recipe[`strIngredient${i}`]
                if (ingredient && ingredient.trim()) {
                    ingredients.push(ingredient.trim())
                }
            }
            return ingredients
        },
        
        getIngredientMeasure(recipe, index) {
            return recipe[`strMeasure${index}`] || ''
        },
        
        async fetchRecipesByIngredient(ingredient) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`
                )
                const data = await response.json()
                return data.meals || []
            } catch (error) {
                console.error('Error fetching recipes for ingredient:', ingredient, error)
                return []
            }
        },
        
        async fetchRecipeDetails(mealId) {
            try {
                const response = await fetch(
                    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${mealId}`
                )
                const data = await response.json()
                return data.meals ? data.meals[0] : null
            } catch (error) {
                console.error('Error fetching recipe details:', error)
                return null
            }
        },
        
        async loadRecipes() {
            this.loading = true
            this.error = null
            
            try {
                let recipes = []
                
                if (this.filters.cuisine) {
                    const response = await fetch(
                        `https://www.themealdb.com/api/json/v1/1/filter.php?a=${this.filters.cuisine}`
                    )
                    const data = await response.json()
                    const basicRecipes = data.meals || []
                    
                    const detailPromises = basicRecipes.slice(0, 20).map(recipe => 
                        this.fetchRecipeDetails(recipe.idMeal)
                    )
                    recipes = await Promise.all(detailPromises)
                    recipes = recipes.filter(r => r !== null)
                    
                } else if (this.filters.dietaryPreference) {
                    const response = await fetch(
                        `https://www.themealdb.com/api/json/v1/1/filter.php?c=${this.filters.dietaryPreference}`
                    )
                    const data = await response.json()
                    const basicRecipes = data.meals || []
                    
                    const detailPromises = basicRecipes.slice(0, 20).map(recipe => 
                        this.fetchRecipeDetails(recipe.idMeal)
                    )
                    recipes = await Promise.all(detailPromises)
                    recipes = recipes.filter(r => r !== null)
                    
                } else {
                    const recipeMap = new Map()
                    
                    for (const ingredient of this.availableIngredients.slice(0, 5)) {
                        const foundRecipes = await this.fetchRecipesByIngredient(ingredient)
                        for (const recipe of foundRecipes.slice(0, 10)) {
                            if (!recipeMap.has(recipe.idMeal)) {
                                const details = await this.fetchRecipeDetails(recipe.idMeal)
                                if (details) {
                                    recipeMap.set(recipe.idMeal, details)
                                }
                            }
                        }
                    }
                    
                    recipes = Array.from(recipeMap.values())
                }
                
                this.recipes = recipes
                this.applyFilters()
                
            } catch (error) {
                console.error('Error loading recipes:', error)
                this.error = 'Failed to load recipes'
            } finally {
                this.loading = false
            }
        },
        
        applyFilters() {
            let filtered = this.recipesWithMatch
            
            if (this.filters.searchQuery) {
                const query = this.filters.searchQuery.toLowerCase()
                filtered = filtered.filter(recipe => 
                    recipe.strMeal.toLowerCase().includes(query)
                )
            }
            
            // Max Time Filter
            if (this.filters.maxTime) {
                const maxMinutes = parseInt(this.filters.maxTime)
                filtered = filtered.filter(recipe => {
                    // Extract cooking time from instructions or use a default estimation
                    const cookingTime = this.estimateCookingTime(recipe)
                    return cookingTime <= maxMinutes
                })
            }
            
            if (this.filters.useExpiringOnly) {
                filtered = filtered.filter(recipe => 
                    recipe.expiringMatchedIngredients.length > 0
                )
            }
            
            this.filteredRecipes = filtered
        },
        estimateCookingTime(recipe) {
            // Try to extract time from instructions
            const instructions = recipe.strInstructions?.toLowerCase() || ''
            
            // Look for time patterns like "30 minutes", "1 hour", "45 mins"
            const timePatterns = [
                /(\d+)\s*(?:hour|hr|hours|hrs)/gi,
                /(\d+)\s*(?:minute|min|minutes|mins)/gi
            ]
            
            let totalMinutes = 0
            let foundTime = false
            
            // Extract hours
            const hourMatch = instructions.match(timePatterns[0])
            if (hourMatch) {
                const hours = parseInt(hourMatch[0].match(/\d+/)[0])
                totalMinutes += hours * 60
                foundTime = true
            }
            
            // Extract minutes
            const minuteMatch = instructions.match(timePatterns[1])
            if (minuteMatch) {
                const minutes = parseInt(minuteMatch[0].match(/\d+/)[0])
                totalMinutes += minutes
                foundTime = true
            }
            
            // If no time found, estimate based on category
            if (!foundTime) {
                const category = recipe.strCategory?.toLowerCase() || ''
                if (category.includes('dessert')) return 45
                if (category.includes('starter') || category.includes('side')) return 20
                if (category.includes('breakfast')) return 15
                return 30  // Default estimation
            }
            
            return totalMinutes
        },
        
        clearFilters() {
            this.filters = {
                cuisine: '',
                maxTime: '',
                dietaryPreference: '',
                searchQuery: '',
                useExpiringOnly: false
            }
            this.applyFilters()
        },
        
        showRecipeDetails(recipe) {
            this.selectedRecipe = recipe
        },
        
        closeRecipeModal() {
            this.selectedRecipe = null
        },
        
        getMatchClass(percentage) {
            if (percentage >= 80) return 'match-excellent'
            if (percentage >= 60) return 'match-good'
            if (percentage >= 40) return 'match-fair'
            return 'match-low'
        },
        
        isIngredientAvailable(ingredientName) {
            const recipeIngredient = ingredientName.toLowerCase().trim();
            const recipeWords = recipeIngredient.split(/\s+/);
            
            return this.availableIngredients.some(inventoryItem => {
                const invItem = inventoryItem.toLowerCase().trim();
                const inventoryWords = invItem.split(/\s+/);
                
                return recipeWords.every(word => inventoryWords.includes(word));
            });
        },
        
        isIngredientExpiring(ingredientName) {
            const recipeIngredient = ingredientName.toLowerCase().trim();
            const recipeWords = recipeIngredient.split(/\s+/);
            
            return this.expiringIngredientNames.some(expiring => {
                const expiringWords = expiring.toLowerCase().trim().split(/\s+/);
                return recipeWords.every(word => expiringWords.includes(word));
            });
        },
        
        async prepareUseRecipe(recipe) {
            this.recipeToUse = recipe
            this.ingredientsToDeduct = []
            
            const recipeIngredients = this.extractRecipeIngredients(recipe)
            
            for (let i = 0; i < recipeIngredients.length; i++) {
                const ingredientName = recipeIngredients[i]
                const measure = this.getIngredientMeasure(recipe, i + 1)
                
                const recipeWords = ingredientName.toLowerCase().trim().split(/\s+/);
                const inventoryItem = this.inventory.find(item => {
                    const inventoryWords = item.name.toLowerCase().trim().split(/\s+/);
                    return recipeWords.every(word => inventoryWords.includes(word));
                });
                
                const quantityMatch = measure.match(/(\d+\.?\d*)/)
                const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1
                
                const recipeUnit = measure.replace(/[\d\.\s]+/, '').trim().toLowerCase()
                const inventoryUnit = inventoryItem ? inventoryItem.unit.toLowerCase() : ''
                
                const unitMatch = this.checkUnitCompatibility(recipeUnit, inventoryUnit)
                
                const isExpiring = inventoryItem ? this.isIngredientExpiring(inventoryItem.name) : false
                
                this.ingredientsToDeduct.push({
                    name: ingredientName,
                    measure: measure,
                    recipeUnit: recipeUnit,
                    quantity: quantity,
                    editableQuantity: quantity,
                    available: !!inventoryItem,
                    inventoryItem: inventoryItem,
                    inventoryUnit: inventoryUnit,
                    unitMatch: unitMatch,
                    checked: !!inventoryItem,
                    isExpiring: isExpiring
                })
            }
            
            this.ingredientsToDeduct.sort((a, b) => {
                if (a.isExpiring && !b.isExpiring) return -1
                if (!a.isExpiring && b.isExpiring) return 1
                if (a.available && !b.available) return -1
                if (!a.available && b.available) return 1
                return 0
            })
            
            this.showUseRecipeConfirmation = true
        },
        
        checkUnitCompatibility(recipeUnit, inventoryUnit) {
            if (!recipeUnit || !inventoryUnit) return 'unknown'
            
            if (recipeUnit === inventoryUnit) return 'exact'
            
            const weightUnits = ['kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'oz', 'lb', 'lbs', 'pound', 'pounds', 'ounce', 'ounces']
            const isRecipeWeight = weightUnits.some(u => recipeUnit.includes(u))
            const isInventoryWeight = weightUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeWeight && isInventoryWeight) return 'compatible'
            
            const volumeUnits = ['l', 'ml', 'liter', 'liters', 'milliliter', 'milliliters', 'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'teaspoon', 'fl oz', 'fluid ounce']
            const isRecipeVolume = volumeUnits.some(u => recipeUnit.includes(u))
            const isInventoryVolume = volumeUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeVolume && isInventoryVolume) return 'compatible'
            
            const countUnits = ['pcs', 'pc', 'piece', 'pieces', 'pack', 'packs', 'item', 'items', 'unit', 'units']
            const isRecipeCount = countUnits.some(u => recipeUnit.includes(u))
            const isInventoryCount = countUnits.some(u => inventoryUnit.includes(u))
            if (isRecipeCount && isInventoryCount) return 'compatible'
            
            if (!recipeUnit || recipeUnit === '') return 'compatible'
            
            return 'mismatch'
        },
        
        cancelUseRecipe() {
            this.showUseRecipeConfirmation = false
            this.recipeToUse = null
            this.ingredientsToDeduct = []
        },
        
        async confirmUseRecipe() {
            this.usingRecipe = true
            
            try {
                const deductionRecord = {
                    recipeId: this.recipeToUse.idMeal,
                    recipeName: this.recipeToUse.strMeal,
                    timestamp: new Date().toISOString(),
                    deductions: []
                }
                
                for (const ingredient of this.ingredientsToDeduct) {
                    if (ingredient.checked && ingredient.available && ingredient.inventoryItem) {
                        const deduction = await this.deductIngredientFromInventory(
                            ingredient.inventoryItem,
                            ingredient.editableQuantity
                        )
                        if (deduction) {
                            deductionRecord.deductions.push(deduction)
                        }
                    }
                }
                
                this.lastDeduction = deductionRecord
                
                await this.fetchInventory()
                await this.fetchExpiringIngredients()
                
                this.showUseRecipeConfirmation = false
                this.closeRecipeModal()
                
                this.showUndoNotification = true
                this.undoTimeRemaining = 15
                
                const countdownInterval = setInterval(() => {
                    this.undoTimeRemaining--
                    if (this.undoTimeRemaining <= 0) {
                        clearInterval(countdownInterval)
                    }
                }, 1000)
                
                if (this.undoTimer) clearTimeout(this.undoTimer)
                this.undoTimer = setTimeout(async () => {
                    clearInterval(countdownInterval)
                    await this.logConsumption()
                    
                    this.showUndoNotification = false
                    this.lastDeduction = null
                }, 15000)
                
            } catch (error) {
                console.error('Error using recipe:', error)
                this.showSuccessMessage('Failed to use recipe. Please try again.', 'error')
            } finally {
                this.usingRecipe = false
            }
        },
        
        async deductIngredientFromInventory(inventoryItem, quantityNeeded) {
            try {
                const sortedBatches = [...inventoryItem.batches]
                    .filter(batch => batch.status === 'active' || !batch.status)
                    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
                
                let remainingQuantity = quantityNeeded
                const batchUpdates = []
                const batchesToDelete = []
                
                for (const batch of sortedBatches) {
                    if (remainingQuantity <= 0) break
                    
                    const currentQuantity = parseFloat(batch.quantity)
                    
                    if (currentQuantity > 0) {
                        const deductAmount = Math.min(currentQuantity, remainingQuantity)
                        const newQuantity = currentQuantity - deductAmount
                        
                        if (newQuantity <= 0) {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .delete()
                                .eq('id', batch.id)
                            
                            if (error) throw error
                            
                            batchesToDelete.push(batch.id)
                        } else {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .update({ 
                                    quantity: newQuantity,
                                    status: 'active'
                                })
                                .eq('id', batch.id)
                            
                            if (error) throw error
                        }
                        
                        batchUpdates.push({
                            batchId: batch.id,
                            previousQuantity: currentQuantity,
                            deductedAmount: deductAmount,
                            newQuantity: newQuantity,
                            previousStatus: batch.status || 'active',
                            expiryDate: batch.expiry_date,
                            wasDeleted: newQuantity <= 0
                        })
                        
                        remainingQuantity -= deductAmount
                    }
                }
                
                const { data: remainingBatches, error: checkError } = await supabase
                    .from('ingredient_batches')
                    .select('id')
                    .eq('ingredient_id', inventoryItem.id)
                
                if (checkError) throw checkError
                
                if (!remainingBatches || remainingBatches.length === 0) {
                    const { error: deleteError } = await supabase
                        .from('ingredients')
                        .delete()
                        .eq('id', inventoryItem.id)
                    
                    if (deleteError) throw deleteError
                }
                
                return {
                    ingredientId: inventoryItem.id,
                    ingredientName: inventoryItem.name,
                    totalDeducted: quantityNeeded - remainingQuantity,
                    batchUpdates: batchUpdates,
                    ingredientDeleted: !remainingBatches || remainingBatches.length === 0
                }
                
            } catch (error) {
                console.error('Error deducting ingredient:', error)
                return null
            }
        },
        
        async undoRecipeUse() {
            if (!this.lastDeduction) return
            
            try {
                for (const deduction of this.lastDeduction.deductions) {
                    if (deduction.ingredientDeleted) {
                        const ingredientInfo = this.inventory.find(i => i.id === deduction.ingredientId)
                        if (ingredientInfo) {
                            const { error: recreateError } = await supabase
                                .from('ingredients')
                                .insert({
                                    id: deduction.ingredientId,
                                    household_id: this.householdId,
                                    name: ingredientInfo.name,
                                    category: ingredientInfo.category,
                                    unit: ingredientInfo.unit
                                })
                            
                            if (recreateError) throw recreateError
                        }
                    }
                    
                    for (const batchUpdate of deduction.batchUpdates) {
                        if (batchUpdate.wasDeleted) {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .insert({
                                    id: batchUpdate.batchId,
                                    ingredient_id: deduction.ingredientId,
                                    quantity: batchUpdate.previousQuantity,
                                    expiry_date: batchUpdate.expiryDate,
                                    status: batchUpdate.previousStatus
                                })
                            
                            if (error) throw error
                        } else {
                            const { error } = await supabase
                                .from('ingredient_batches')
                                .update({ 
                                    quantity: batchUpdate.previousQuantity,
                                    status: batchUpdate.previousStatus
                                })
                                .eq('id', batchUpdate.batchId)
                            
                            if (error) throw error
                        }
                    }
                }
                
                await this.fetchInventory()
                await this.fetchExpiringIngredients()
                
                this.showUndoNotification = false
                this.lastDeduction = null
                
                if (this.undoTimer) {
                    clearTimeout(this.undoTimer)
                    this.undoTimer = null
                }
                
                this.showSuccessMessage('Recipe use has been undone successfully!')
                
            } catch (error) {
                console.error('Error undoing recipe use:', error)
                this.showSuccessMessage('Failed to undo. Please check your inventory manually.', 'error')
            }
        },
        
        dismissUndo() {
            this.showUndoNotification = false
            this.lastDeduction = null
            if (this.undoTimer) {
                clearTimeout(this.undoTimer)
                this.undoTimer = null
            }
        },
        
        showSuccessMessage(message, type = 'success') {
            this.successMessage = message
            this.showSuccessNotification = true
            
            if (this.successTimer) {
                clearTimeout(this.successTimer)
            }
            
            this.successTimer = setTimeout(() => {
                this.showSuccessNotification = false
            }, 4000)
        },
        
        dismissSuccessNotification() {
            this.showSuccessNotification = false
            if (this.successTimer) {
                clearTimeout(this.successTimer)
                this.successTimer = null
            }
        },
        
        async logConsumption() {
            if (!this.lastDeduction || !this.householdId) return
            
            try {
                const consumptionLogs = []
                
                for (const deduction of this.lastDeduction.deductions) {
                    let totalQuantityUsed = 0
                    for (const batchUpdate of deduction.batchUpdates) {
                        totalQuantityUsed += batchUpdate.deductedAmount
                    }
                    
                    consumptionLogs.push({
                        ingredient_id: deduction.ingredientId,
                        batch_id: null,
                        user_id: this.householdId,
                        quantity_used: totalQuantityUsed,
                        recipe_name: this.lastDeduction.recipeName,
                        consumed_date: this.lastDeduction.timestamp
                    })
                }
                
                if (consumptionLogs.length > 0) {
                    const { error } = await supabase
                        .from('consumption_logs')
                        .insert(consumptionLogs)
                    
                    if (error) {
                        console.error('Error logging consumption:', error)
                    }
                }
                
            } catch (error) {
                console.error('Error in logConsumption:', error)
            }
        }
    },
    
    watch: {
        filters: {
            handler() {
                this.applyFilters()
            },
            deep: true
        },
        
        householdId(newVal) {
            if (newVal) {
                this.fetchInventory()
                this.fetchExpiringIngredients()
            }
        }
    },
    
    async mounted() {
        this.initialising = true
        await this.fetchSession()
        await this.fetchHouseholdId()
        
        if (this.householdId) {
            await this.fetchInventory()
            await this.fetchExpiringIngredients()
            
            // Only load recipes if inventory is not empty
            if (this.inventory.length > 0) {
                await this.loadRecipes()
            }
        } else {
            console.error('Unable to load recipes: No household ID available')
            this.error = 'Unable to load your household data. Please make sure you have a household set up.'
        }
        this.initialising = false
    },
    
    beforeUnmount() {
        if (this.undoTimer) {
            clearTimeout(this.undoTimer)
        }
        if (this.successTimer) {
            clearTimeout(this.successTimer)
        }
    }
}
</script>

<template>
    <div class="recipes-container">
        <!-- Header -->
        <div class="recipes-header">
            <h1>Recipe Suggestions</h1>
            <p class="subtitle">Based on your available ingredients</p>
            
            <div v-if="expiringIngredients.length > 0" class="expiring-alert-modern">
                <div class="expiring-alert-header">
                    <div class="expiring-icon-badge">
                        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" stroke-linecap="round"/>
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="expiring-alert-title">
                        <h3>{{ expiringIngredients.length }} Ingredient{{ expiringIngredients.length !== 1 ? 's' : '' }} Expiring Soon!</h3>
                        <p>Use these ingredients first to reduce waste</p>
                    </div>
                </div>
                <div class="expiring-ingredients-grid">
                    <div 
                        v-for="(item, index) in expiringIngredients" 
                        :key="item.id"
                        class="expiring-ingredient-chip"
                    >
                        <span class="chip-icon">🔥</span>
                        <span class="chip-name">{{ item.name }}</span>
                        <span v-if="item.expiryDate" class="chip-date">
                            {{ new Date(item.expiryDate).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State when no inventory -->
        <div v-if="!initialising && !loading && inventory.length === 0" class="empty-state-container">
            <div class="empty-state-card">
                <!-- Illustration/Icon Section -->
                <div class="empty-state-visual">
                    <div class="empty-state-icon-wrapper">
                        <span class="empty-state-icon-large">🥗</span>
                    </div>
                </div>
            
                <!-- Content Section -->
                <div class="empty-state-content">
                    <h2 class="empty-state-title">Your Recipe Journey Starts Here!</h2>
                    <p class="empty-state-description">
                        Add ingredients to your pantry and unlock personalised recipe suggestions 
                        tailored to what you have on hand.
                    </p>
                    
                    <!-- Feature Highlights -->
                    <div class="empty-state-features">
                        <div class="feature-item">
                            <span class="feature-icon">✨</span>
                            <span class="feature-text">Smart Matching</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">⏰</span>
                            <span class="feature-text">Use Expiring Items</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-icon">🌍</span>
                            <span class="feature-text">Global Cuisines</span>
                        </div>
                    </div>
                    
                    <!-- Call to Action -->
                    <div class="empty-state-actions">
                        <router-link to="/inventory" class="btn-empty-state btn-primary-empty">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Add Your First Ingredient
                        </router-link>
                        <button class="btn-empty-state btn-secondary-empty" @click="showEmptyStateHelp">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                                <path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            How It Works
                        </button>
                    </div>
                </div>
            
                <!-- Optional: Preview Cards -->
                <div class="empty-state-preview">
                    <p class="preview-label">What you'll get:</p>
                    <div class="preview-cards">
                        <div class="preview-card">
                            <div class="preview-badge">80% Match</div>
                            <div class="preview-image">🍝</div>
                            <p class="preview-title">Recipe Suggestions</p>
                        </div>
                        <div class="preview-card">
                            <div class="preview-badge">⏰ Alert</div>
                            <div class="preview-image">📅</div>
                            <p class="preview-title">Expiry Tracking</p>
                        </div>
                        <div class="preview-card">
                            <div class="preview-badge">Smart Tips</div>
                            <div class="preview-image">💡</div>
                            <p class="preview-title">Reduce Waste</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filters Section (only show if inventory has items) -->
        <div v-if="!initialising && inventory.length > 0" class="filters-section">
            <h3>Filter Recipes</h3>
            
            <div class="filters-grid">
                <div class="filter-item">
                    <label class="form-label">Search by name</label>
                    <input 
                        type="text" 
                        class="form-control" 
                        v-model="filters.searchQuery"
                        placeholder="e.g., Pasta, Chicken..."
                        aria-label="Search recipes by name"
                    >
                </div>

                <div class="filter-item">
                    <label class="form-label">Cuisine</label>
                    <select 
                        class="form-select" 
                        v-model="filters.cuisine" 
                        @change="loadRecipes"
                        aria-label="Filter by cuisine"
                    >
                        <option value="">All Cuisines</option>
                        <option v-for="cuisine in cuisines" :key="cuisine" :value="cuisine">
                            {{ cuisine }}
                        </option>
                    </select>
                </div>

                <div class="filter-item">
                    <label class="form-label">Dietary Preference</label>
                    <select 
                        class="form-select" 
                        v-model="filters.dietaryPreference" 
                        @change="loadRecipes"
                        aria-label="Filter by dietary preference"
                    >
                        <option value="">All Types</option>
                        <option v-for="diet in dietaryOptions" :key="diet" :value="diet">
                            {{ diet }}
                        </option>
                    </select>
                </div>

                <div class="filter-item">
                    <label class="form-label">Max Cooking Time (minutes)</label>
                    <input 
                        type="number" 
                        class="form-control" 
                        v-model="filters.maxTime"
                        placeholder="e.g., 30"
                        min="0"
                        aria-label="Maximum cooking time in minutes"
                    >
                </div>

                <div class="filter-item filter-checkbox">
                    <div class="form-check">
                        <input 
                            class="form-check-input" 
                            type="checkbox" 
                            id="expiringOnly"
                            v-model="filters.useExpiringOnly"
                        >
                        <label class="form-check-label" for="expiringOnly">
                            <strong>Show only recipes using expiring ingredients</strong>
                        </label>
                    </div>
                </div>
            </div>

            <div class="filter-actions">
                <button class="btn btn-secondary" @click="clearFilters">Clear Filters</button>
                <button class="btn btn-primary" @click="loadRecipes">Refresh Recipes</button>
            </div>
        </div>

        <RecipeLoadingSkeleton 
            v-if="initialising || loading" 
            :skeleton-count="6" 
        />

        <!-- Error State -->
        <div v-if="!initialising && !loading && error" class="alert alert-danger" role="alert">
            {{ error }}
        </div>

        <!-- Recipes Grid (only show if inventory has items) -->
        <div v-if="!initialising && !loading && !error && inventory.length > 0" class="recipes-grid">
            <div 
                v-for="recipe in filteredRecipes" 
                :key="recipe.idMeal"
                class="recipe-card"
                @click="showRecipeDetails(recipe)"
                @keypress.enter="showRecipeDetails(recipe)"
                role="button"
                tabindex="0"
                :aria-label="`View details for ${recipe.strMeal}`"
            >
                <div class="recipe-image-container">
                    <img 
                        :src="recipe.strMealThumb" 
                        :alt="recipe.strMeal" 
                        class="recipe-image"
                        loading="lazy"
                    >
                    
                    <div class="match-badge" :class="getMatchClass(recipe.matchPercentage)">
                        {{ recipe.matchPercentage }}% Match
                    </div>
                    
                    <div v-if="recipe.expiringMatchedIngredients.length > 0" class="expiring-badge">
                        ⏰ Uses {{ recipe.expiringMatchedIngredients.length }} expiring
                    </div>
                </div>

                <div class="recipe-content">
                    <h4 class="recipe-title">{{ recipe.strMeal }}</h4>
                    
                    <div class="recipe-meta">
                        <span class="badge bg-info">{{ recipe.strArea }}</span>
                        <span class="badge bg-secondary">{{ recipe.strCategory }}</span>
                    </div>

                    <div class="ingredient-summary">
                        <p class="mb-1">
                            <strong>✓ {{ recipe.matchedIngredients.length }}</strong> / 
                            {{ recipe.totalIngredients }} ingredients available
                        </p>
                        
                        <div v-if="recipe.expiringMatchedIngredients.length > 0" class="expiring-ingredients">
                            <small>
                                <strong>⏰ Expiring soon:</strong>
                                {{ recipe.expiringMatchedIngredients.join(', ') }}
                            </small>
                        </div>
                        
                        <div v-if="recipe.missingIngredients.length > 0" class="missing-ingredients">
                            <small class="text-muted">
                                <strong>Missing:</strong> {{ recipe.missingIngredients.slice(0, 3).join(', ') }}
                                <span v-if="recipe.missingIngredients.length > 3">...</span>
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- No Results -->
            <div v-if="filteredRecipes.length === 0" class="col-12 text-center my-5 no-results">
                <div class="no-results-icon">🔍</div>
                <p class="text-muted">No recipes found matching your criteria.</p>
                <button class="btn btn-primary" @click="clearFilters">Clear Filters</button>
            </div>
        </div>

        <!-- RECIPE DETAIL MODAL -->
        <div 
            v-if="selectedRecipe" 
            class="recipe-modal" 
            @click.self="closeRecipeModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-modal-title"
        >
            <div class="recipe-modal-content recipe-detail-modal-styled">
                <button 
                    class="btn-close-modal" 
                    @click="closeRecipeModal"
                    aria-label="Close recipe details"
                >
                    &times;
                </button>
                
                <div class="recipe-detail-layout-styled">
                    <!-- Left Side: Recipe Image with Info Cards & buttons -->
                    <div class="recipe-detail-left">
                        <div class="recipe-image-wrapper">
                            <img 
                                :src="selectedRecipe.strMealThumb" 
                                :alt="selectedRecipe.strMeal" 
                                class="detail-recipe-image-styled"
                            >
                        </div>
                        
                        <!-- Match Badge Card -->
                        <div class="match-card" :class="getMatchClass(selectedRecipe.matchPercentage)">
                            <div class="match-percentage">{{ selectedRecipe.matchPercentage }}%</div>
                            <div class="match-text">Ingredient Match</div>
                        </div>
                        
                        <!-- Expiring Ingredients Card -->
                        <div v-if="selectedRecipe.expiringMatchedIngredients.length > 0" class="expiring-card">
                            <div class="expiring-icon">🔥</div>
                            <div class="expiring-text">
                                <strong>Expiring Ingredients</strong>
                                <p>{{ selectedRecipe.expiringMatchedIngredients.join(', ') }}</p>
                            </div>
                        </div>
                        
                        <!-- ACTION BUTTONS -->
                        <!-- ACTION BUTTONS -->
                        <div class="recipe-modal-actions-sidebar">
                            <a v-if="selectedRecipe.strYoutube" 
                            :href="selectedRecipe.strYoutube" 
                            target="_blank" 
                            class="btn btn-danger btn-sidebar"
                            rel="noopener noreferrer"
                            >
                                <svg class="btn-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                Watch Video Tutorial
                            </a>
                            <button class="btn btn-success btn-sidebar" @click="prepareUseRecipe(selectedRecipe)">
                                <svg class="btn-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <path d="M9 11l3 3L22 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Use This Recipe
                            </button>
                        </div>
                    </div>

                    <!-- Right Side: Ingredients & Instructions -->
                    <div class="recipe-detail-right">
                        <div class="recipe-title-section">
                            <h2 class="recipe-modal-title" id="recipe-modal-title">{{ selectedRecipe.strMeal }}</h2>
                            <div class="recipe-modal-badges">
                                <span class="badge bg-secondary">{{ selectedRecipe.strCategory }}</span>
                                <span class="badge bg-info">{{ selectedRecipe.strArea }}</span>
                            </div>
                        </div>
                        
                        <div class="recipe-scrollable-content">
                            <h4 class="section-heading">Ingredients</h4>
                            <ul class="ingredients-list-styled">
                                <li 
                                    v-for="ingredient in sortedRecipeIngredients" 
                                    :key="ingredient.index"
                                    class="ingredient-item-styled"
                                    :class="{
                                        'ingredient-available-styled': ingredient.isAvailable && !ingredient.isExpiring,
                                        'ingredient-expiring-styled': ingredient.isExpiring,
                                        'ingredient-missing-styled': !ingredient.isAvailable
                                    }"
                                >
                                    <span class="ingredient-check-icon" aria-hidden="true">
                                        <span v-if="ingredient.isExpiring" class="icon-container">
                                            <span class="check-icon">✓</span>
                                            <span class="fire-icon">🔥</span>
                                        </span>
                                        <span v-else>
                                            {{ ingredient.isAvailable ? '✓' : '✗' }}
                                        </span>
                                    </span>
                                    <span class="ingredient-text-styled">
                                        {{ ingredient.measure }} {{ ingredient.name }}
                                    </span>
                                </li>
                            </ul>

                            <h4 class="section-heading">Instructions</h4>
                            <div class="instructions-styled">
                                {{ selectedRecipe.strInstructions }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Use Recipe Confirmation Modal -->
        <div 
            v-if="showUseRecipeConfirmation" 
            class="recipe-modal" 
            @click.self="cancelUseRecipe"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div class="recipe-modal-content use-recipe-modal-new">
                <button 
                    class="btn-close-modal" 
                    @click="cancelUseRecipe"
                    aria-label="Cancel and close"
                >
                    &times;
                </button>
                
                <div v-if="recipeToUse" class="recipe-confirmation-layout-new">
                    <!-- Header Section -->
                    <div class="confirmation-header-new">
                        <div class="confirmation-image-left">
                            <img 
                                :src="recipeToUse.strMealThumb" 
                                :alt="recipeToUse.strMeal" 
                                class="confirmation-recipe-image-redesign"
                            >
                        </div>
                        <div class="confirmation-info-right">
                            <div class="confirmation-badges-top">
                                <span class="badge bg-secondary">{{ recipeToUse.strCategory }}</span>
                                <span class="badge bg-info">{{ recipeToUse.strArea }}</span>
                            </div>
                            <h2 class="confirmation-recipe-name-new" id="confirm-modal-title">{{ recipeToUse.strMeal }}</h2>
                            <div class="confirmation-stats">
                                <div class="stat-item">
                                    <div class="stat-value" :class="getMatchClass(recipeToUse.matchPercentage)">
                                        {{ recipeToUse.matchPercentage }}%
                                    </div>
                                    <div class="stat-label">Match</div>
                                </div>
                                <div class="stat-divider"></div>
                                <div class="stat-item">
                                    <div class="stat-value">{{ ingredientsToDeduct.filter(i => i.available).length }}/{{ ingredientsToDeduct.length }}</div>
                                    <div class="stat-label">Available</div>
                                </div>
                                <template v-if="ingredientsToDeduct.filter(i => i.isExpiring).length > 0">
                                    <div class="stat-divider"></div>
                                    <div class="stat-item">
                                        <div class="stat-value expiring-stat">{{ ingredientsToDeduct.filter(i => i.isExpiring).length }}</div>
                                        <div class="stat-label">Expiring</div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ingredients List -->
                    <div class="ingredients-section-redesign">
                        <h3 class="section-title-redesign">
                            <span>Select Ingredients to Use</span>
                            <span class="ingredients-count">{{ ingredientsToDeduct.filter(i => i.checked).length }} selected</span>
                        </h3>
                        
                        <div class="ingredients-list-redesign">
                            <div 
                                v-for="(ingredient, index) in ingredientsToDeduct" 
                                :key="index"
                                class="ingredient-card-redesign"
                                :class="{
                                    'is-expiring': ingredient.isExpiring,
                                    'is-available': ingredient.available && !ingredient.isExpiring,
                                    'is-missing': !ingredient.available,
                                    'is-unchecked': !ingredient.checked
                                }"
                            >
                                <div class="ingredient-card-main">
                                    <!-- Checkbox -->
                                    <div class="ingredient-checkbox-wrapper">
                                        <input 
                                            type="checkbox" 
                                            v-model="ingredient.checked"
                                            :disabled="!ingredient.available"
                                            :id="'ingredient-' + index"
                                            class="custom-checkbox"
                                            :aria-label="`Use ${ingredient.name}`"
                                        >
                                        <label :for="'ingredient-' + index" class="checkbox-label"></label>
                                    </div>
                                    
                                    <!-- Status Indicator -->
                                    <div class="ingredient-status-indicator">
                                        <span v-if="ingredient.isExpiring" class="status-badge badge-expiring" aria-label="Expiring soon">
                                            <span class="icon">⏰</span>
                                        </span>
                                        <span v-else-if="ingredient.available" class="status-badge badge-available" aria-label="Available">
                                            <span class="icon">✓</span>
                                        </span>
                                        <span v-else class="status-badge badge-missing" aria-label="Not available">
                                            <span class="icon">✗</span>
                                        </span>
                                    </div>
                                    
                                    <!-- Ingredient Info -->
                                    <div class="ingredient-info-wrapper">
                                        <div class="ingredient-name-redesign">{{ ingredient.name }}</div>
                                        <div class="ingredient-measure-redesign">{{ ingredient.measure }}</div>
                                    </div>
                                    
                                    <!-- Quantity Editor -->
                                    <div class="ingredient-quantity-wrapper" v-if="ingredient.available">
                                        <input 
                                            type="number" 
                                            v-model.number="ingredient.editableQuantity"
                                            :disabled="!ingredient.checked"
                                            class="quantity-input-redesign"
                                            step="0.01"
                                            min="0"
                                            :aria-label="`Quantity of ${ingredient.name} to use`"
                                        >
                                        <span class="quantity-unit-redesign">{{ ingredient.inventoryUnit }}</span>
                                        <span v-if="ingredient.unitMatch === 'mismatch'" 
                                              class="unit-warning" 
                                              title="Unit mismatch - please verify"
                                              role="img"
                                              aria-label="Warning: unit mismatch">
                                            ⚠️
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="modal-actions-redesign">
                        <button 
                            class="btn-redesign btn-cancel-redesign" 
                            @click="cancelUseRecipe"
                            :disabled="usingRecipe"
                        >
                            Cancel
                        </button>
                        <button 
                            class="btn-redesign btn-confirm-redesign" 
                            @click="confirmUseRecipe"
                            :disabled="usingRecipe || ingredientsToDeduct.filter(i => i.checked).length === 0"
                        >
                            <span v-if="usingRecipe">
                                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Processing...
                            </span>
                            <span v-else>
                                <span class="btn-icon">✓</span>
                                Use Recipe
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- HOW IT WORKS MODAL -->
        <div 
            v-if="showHowItWorksModal" 
            class="recipe-modal" 
            @click.self="closeHowItWorksModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
        >
            <div class="recipe-modal-content how-it-works-modal">
                <button 
                    class="btn-close-modal" 
                    @click="closeHowItWorksModal"
                    aria-label="Close how it works guide"
                >
                    &times;
                </button>
                
                <div class="how-it-works-content">
                    <!-- Header -->
                    <div class="how-it-works-header">
                        <div class="how-it-works-icon-badge">
                            <span class="badge-icon">✨</span>
                        </div>
                        <h2 id="how-it-works-title" class="how-it-works-title">How Recipe Suggestions Work</h2>
                        <p class="how-it-works-subtitle">Get personalised recipes based on your pantry</p>
                    </div>
                    
                    <!-- Steps -->
                    <div class="how-it-works-steps">
                        <div class="step-card">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <div class="step-icon">🥬</div>
                                <h3 class="step-title">Add Your Ingredients</h3>
                                <p class="step-description">
                                    Start by adding ingredients from your pantry to your inventory. 
                                    Include expiry dates to track freshness.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <div class="step-icon">🔍</div>
                                <h3 class="step-title">Smart Matching</h3>
                                <p class="step-description">
                                    Our system analyses your inventory and finds recipes that match 
                                    your available ingredients.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <div class="step-icon">⏰</div>
                                <h3 class="step-title">Prioritise Expiring Items</h3>
                                <p class="step-description">
                                    Recipes using ingredients expiring soon are highlighted, 
                                    helping you reduce food waste.
                                </p>
                            </div>
                        </div>
                        
                        <div class="step-arrow">→</div>
                        
                        <div class="step-card">
                            <div class="step-number">4</div>
                            <div class="step-content">
                                <div class="step-icon">🍳</div>
                                <h3 class="step-title">Cook & Track</h3>
                                <p class="step-description">
                                    Select a recipe to cook, and we'll automatically deduct 
                                    used ingredients from your inventory.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Features -->
                    <div class="how-it-works-features">
                        <h3 class="features-title">What You Get:</h3>
                        <div class="features-grid">
                            <div class="feature-box">
                                <span class="feature-box-icon">📊</span>
                                <span class="feature-box-text">Match percentage for each recipe</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">🌍</span>
                                <span class="feature-box-text">Recipes from global cuisines</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">🎯</span>
                                <span class="feature-box-text">Filter by cuisine & dietary needs</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">📹</span>
                                <span class="feature-box-text">Video tutorials included</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">♻️</span>
                                <span class="feature-box-text">Reduce food waste</span>
                            </div>
                            <div class="feature-box">
                                <span class="feature-box-icon">💡</span>
                                <span class="feature-box-text">See missing ingredients</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Call to Action -->
                    <div class="how-it-works-footer">
                        <router-link to="/inventory" class="btn-modal-cta" @click="closeHowItWorksModal">
                            <svg class="btn-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            Start Adding Ingredients
                        </router-link>
                    </div>
                </div>
            </div>
        </div>

        <!-- SUCCESS NOTIFICATION (TOP CENTER) -->
        <transition name="slide-down">
            <div 
                v-if="showSuccessNotification" 
                class="success-notification-top"
                role="alert"
                aria-live="polite"
                aria-atomic="true"
            >
                <div class="success-notification-card">
                    <div class="success-notification-content">
                        <div class="success-icon-wrapper">
                            <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <p class="success-message-text">{{ successMessage }}</p>
                        <button 
                            class="success-dismiss-btn" 
                            @click="dismissSuccessNotification"
                            aria-label="Dismiss notification"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18" stroke-width="2" stroke-linecap="round"/>
                                <line x1="6" y1="6" x2="18" y2="18" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </transition>

        <!-- IMPROVED UNDO NOTIFICATION TOAST -->
        <div 
            v-if="showUndoNotification" 
            class="undo-toast-improved"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
        >
            <div class="undo-toast-card">
                <!-- Progress Bar -->
                <div class="undo-progress-bar">
                    <div 
                        class="undo-progress-fill" 
                        :style="{ width: undoProgressWidth + '%' }"
                    ></div>
                </div>
                
                <!-- Content -->
                <div class="undo-content-wrapper">
                    <!-- Icon and Message -->
                    <div class="undo-message-section">
                        <div class="undo-icon-circle">
                            <svg class="checkmark-icon" viewBox="0 0 52 52" aria-hidden="true">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                            </svg>
                        </div>
                        <div class="undo-text-content">
                            <h4 class="undo-title">Recipe Used Successfully!</h4>
                            <p class="undo-subtitle" v-if="lastDeduction">
                                {{ lastDeduction.recipeName }}
                            </p>
                            <p class="undo-timer">
                                <svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Undo available for {{ undoTimeRemaining }}s
                            </p>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="undo-actions-section">
                        <button 
                            class="undo-btn undo-btn-primary" 
                            @click="undoRecipeUse"
                            aria-label="Undo recipe use"
                        >
                            <svg class="undo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                <path d="M3 7v6h6"></path>
                                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
                            </svg>
                            Undo Recipe Use
                        </button>
                        <button 
                            class="undo-btn undo-btn-dismiss" 
                            @click="dismissUndo"
                            aria-label="Dismiss notification"
                        >
                            <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
/* ============================================
   CSS CUSTOM PROPERTIES & BREAKPOINTS
   ============================================ */
:root {
    /* Colors */
    --primary-green: #4CAF50;
    --primary-green-dark: #45a049;
    --primary-green-light: #66BB6A;
    --secondary-gray: #6c757d;
    --bg-light: #f8f9fa;
    --bg-white: #ffffff;
    --text-primary: #2c3e50;
    --text-secondary: #6c757d;
    --border-color: #e9ecef;
    --success: #28a745;
    --warning: #ffc107;
    --danger: #dc3545;
    --info: #17a2b8;
    
    /* Spacing */
    --spacing-xs: 0.5rem;
    --spacing-sm: 1rem;
    --spacing-md: 1.5rem;
    --spacing-lg: 2rem;
    --spacing-xl: 3rem;
    
    /* Border Radius */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    
    /* Shadows */
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
    --shadow-xl: 0 12px 40px rgba(0, 0, 0, 0.25);
    --navbar-height: 70px;;
    
    /* Breakpoints (for reference - used in media queries) */
    /* xs: 0px - 479px */
    /* sm: 480px - 767px */
    /* md: 768px - 1023px */
    /* lg: 1024px - 1279px */
    /* xl: 1280px - 1535px */
    /* xxl: 1536px+ */
    
    /* Transitions */
    --transition-fast: 0.2s ease;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.4s ease;
}

/* ============================================
   BASE STYLES & LAYOUT
   ============================================ */
.recipes-container {
    max-width: min(1200px, 100% - 2rem);
    margin: 0 auto;
    padding: clamp(15px, 3vw, 20px);
    width: 100%;
    position: relative;
}

/* Subtle background pattern */
.recipes-container::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
        radial-gradient(circle at 20% 50%, rgba(76, 175, 80, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(76, 175, 80, 0.03) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
}

/* ============================================
   HEADER SECTION
   ============================================ */
.recipes-header {
    text-align: center;
    margin-bottom: clamp(20px, 5vw, 30px);
    padding: clamp(20px, 4vw, 40px) clamp(15px, 3vw, 20px);
    background: linear-gradient(135deg, #f0f7f1 0%, #ffffff 100%);
    border-radius: var(--radius-lg);
    position: relative;
    overflow: hidden;
}

.recipes-header h1 {
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 10px;
    line-height: 1.2;
}

.subtitle {
    color: var(--text-secondary);
    font-size: clamp(0.95rem, 2vw, 1.1rem);
}

/* ============================================
   EXPIRING ALERT - MODERN REDESIGN
   ============================================ */
.expiring-alert-modern {
    background: linear-gradient(135deg, #fff9f0 0%, #fff3e6 100%);
    border: 2px solid #ff9800;
    border-left: 6px solid #ff6b00;
    border-radius: var(--radius-lg);
    padding: clamp(20px, 4vw, 28px);
    margin-top: var(--spacing-md);
    box-shadow: 0 8px 24px rgba(255, 152, 0, 0.15);
    transition: all var(--transition-normal);
    overflow: hidden;
    position: relative;
}

.expiring-alert-modern::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #ff6b00, #ff9800, #ffc107);
    animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.expiring-alert-modern:hover {
    box-shadow: 0 12px 32px rgba(255, 152, 0, 0.25);
    transform: translateY(-2px);
}

/* Header Section */
.expiring-alert-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(14px, 3vw, 18px);
    margin-bottom: clamp(16px, 3vw, 20px);
}

@media (max-width: 599px) {
    .expiring-alert-header {
        flex-direction: column;
        text-align: center;
        align-items: center;
    }
}

.expiring-icon-badge {
    flex-shrink: 0;
    width: clamp(48px, 12vw, 56px);
    height: clamp(48px, 12vw, 56px);
    background: linear-gradient(135deg, #ff6b00 0%, #ff9800 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(255, 107, 0, 0.4);
    animation: pulseGlow 2s ease-in-out infinite;
}

@keyframes pulseGlow {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 4px 16px rgba(255, 107, 0, 0.4);
    }
    50% {
        transform: scale(1.05);
        box-shadow: 0 6px 24px rgba(255, 107, 0, 0.6);
    }
}

.alert-icon {
    width: clamp(24px, 6vw, 28px);
    height: clamp(24px, 6vw, 28px);
    stroke: white;
    stroke-width: 2.5;
}

.expiring-alert-title {
    flex: 1;
    min-width: 0;
}

.expiring-alert-title h3 {
    font-size: clamp(1.1rem, 2.5vw, 1.3rem);
    font-weight: 700;
    color: #cc5500;
    margin: 0 0 6px 0;
    line-height: 1.3;
}

.expiring-alert-title p {
    font-size: clamp(0.85rem, 1.9vw, 0.95rem);
    color: #995200;
    margin: 0;
    font-weight: 500;
    opacity: 0.9;
}

/* Ingredients Grid */
.expiring-ingredients-grid {
    display: grid;
    gap: clamp(10px, 2vw, 12px);
}

/* XS: 1 column */
@media (max-width: 479px) {
    .expiring-ingredients-grid {
        grid-template-columns: 1fr;
    }
}

/* SM: 2 columns */
@media (min-width: 480px) and (max-width: 767px) {
    .expiring-ingredients-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* MD+: 3 columns */
@media (min-width: 768px) {
    .expiring-ingredients-grid {
        grid-template-columns: repeat(auto-fill, minmax(clamp(180px, 25vw, 220px), 1fr));
    }
}

.expiring-ingredient-chip {
    background: white;
    border: 2px solid #ffe0b2;
    border-radius: 12px;
    padding: clamp(10px, 2vw, 12px) clamp(12px, 2.5vw, 16px);
    display: flex;
    align-items: center;
    gap: clamp(8px, 1.5vw, 10px);
    transition: all var(--transition-fast);
    cursor: default;
    min-height: 48px;
}

.expiring-ingredient-chip:hover {
    background: #fffaf5;
    border-color: #ff9800;
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
}

.chip-icon {
    font-size: clamp(1.3em, 3vw, 1.5em);
    flex-shrink: 0;
    animation: flicker 1.5s ease-in-out infinite;
}

@keyframes flicker {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

.chip-name {
    flex: 1;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    font-weight: 600;
    color: #cc5500;
    line-height: 1.4;
}

.chip-date {
    font-size: clamp(0.75rem, 1.7vw, 0.8rem);
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #ff6b00 0%, #ff9800 100%);
    padding: 4px 10px;
    border-radius: 20px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
}

/* Responsive adjustments for very small screens */
@media (max-width: 360px) {
    .expiring-ingredient-chip {
        flex-wrap: wrap;
        justify-content: space-between;
    }
    
    .chip-date {
        width: 100%;
        text-align: center;
        margin-top: 6px;
    }
}

/* ============================================
   FILTERS SECTION
   ============================================ */
.filters-section {
    background: var(--bg-light);
    padding: clamp(20px, 4vw, 25px);
    border-radius: var(--radius-md);
    margin-bottom: clamp(20px, 4vw, 30px);
    box-shadow: var(--shadow-sm);
}

.filters-section h3 {
    margin-bottom: var(--spacing-md);
    color: var(--text-primary);
    font-weight: 600;
    font-size: clamp(1.1rem, 2.5vw, 1.3rem);
}

.filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
    gap: clamp(12px, 2vw, 16px);
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
}

.filter-checkbox {
    grid-column: 1 / -1;
    align-items: center;
    justify-content: flex-start;
}

.form-label {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
}

.form-control,
.form-select {
    padding: clamp(8px, 1.5vw, 12px);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: clamp(0.9rem, 2vw, 1rem);
    transition: all var(--transition-fast);
    width: 100%;
}

.form-control:focus,
.form-select:focus {
    border-color: var(--primary-green);
    outline: none;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.filter-actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    margin-top: var(--spacing-md);
}

.filter-actions button {
    min-height: 44px;
    padding: clamp(10px, 2vw, 12px) clamp(16px, 3vw, 20px);
    font-size: clamp(0.9rem, 2vw, 1rem);
    flex: 1;
    min-width: 140px;
}

/* ============================================
   RECIPES GRID - RESPONSIVE BREAKPOINTS
   ============================================ */
.recipes-grid {
    display: grid;
    gap: clamp(15px, 2.5vw, 25px);
    margin-top: clamp(20px, 4vw, 30px);
}

/* XS: 0px - 479px (Extra small phones) */
@media (max-width: 479px) {
    .recipes-grid {
        grid-template-columns: 1fr;
    }
}

/* SM: 480px - 767px (Small phones - landscape) */
@media (min-width: 480px) and (max-width: 767px) {
    .recipes-grid {
        grid-template-columns: 1fr;
    }
}

/* MD: 768px - 1023px (Tablets) */
@media (min-width: 768px) and (max-width: 1023px) {
    .recipes-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* LG: 1024px - 1279px (Small laptops) */
@media (min-width: 1024px) and (max-width: 1279px) {
    .recipes-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* XL: 1280px - 1535px (Laptops) */
@media (min-width: 1280px) and (max-width: 1535px) {
    .recipes-grid {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
}

/* XXL: 1536px+ (Large desktops) */
@media (min-width: 1536px) {
    .recipes-container {
        max-width: 1400px;
    }
    
    .recipes-grid {
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }
}

/* ============================================
   RECIPE CARDS
   ============================================ */
.recipe-card {
    background: var(--bg-white);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    transition: all var(--transition-normal);
    cursor: pointer;
    min-height: 380px;
    display: flex;
    flex-direction: column;
}

.recipe-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-lg);
}

.recipe-card:focus {
    outline: 3px solid var(--primary-green);
    outline-offset: 2px;
}

.recipe-image-container {
    position: relative;
    height: clamp(180px, 30vw, 220px);
    overflow: hidden;
}

.recipe-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-normal);
}

.recipe-card:hover .recipe-image {
    transform: scale(1.05);
}

.match-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 14px);
    border-radius: 20px;
    font-weight: bold;
    font-size: clamp(0.8em, 1.8vw, 0.9em);
    color: white;
    backdrop-filter: blur(10px);
    box-shadow: var(--shadow-md);
}

.expiring-badge {
    position: absolute;
    top: clamp(45px, 10vw, 55px);
    right: 12px;
    background: #ff6b6b;
    color: white;
    padding: clamp(5px, 1vw, 6px) clamp(10px, 2vw, 12px);
    border-radius: 15px;
    font-size: clamp(0.7em, 1.5vw, 0.75em);
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.match-badge.match-excellent { background: rgba(40, 167, 69, 0.95); }
.match-badge.match-good { background: rgba(23, 162, 184, 0.95); }
.match-badge.match-fair { background: rgba(255, 193, 7, 0.95); }
.match-badge.match-low { background: rgba(220, 53, 69, 0.95); }

.recipe-content {
    padding: clamp(15px, 3vw, 20px);
    flex: 1;
    display: flex;
    flex-direction: column;
}

.recipe-title {
    font-size: clamp(1.05rem, 2.5vw, 1.2rem);
    margin-bottom: 12px;
    color: var(--text-primary);
    font-weight: 600;
    line-height: 1.4;
    flex-shrink: 0;
}

.recipe-meta {
    margin-bottom: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
}

.badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: clamp(0.75rem, 1.5vw, 0.85rem);
    font-weight: 600;
}

.ingredient-summary {
    font-size: clamp(0.85rem, 1.8vw, 0.9rem);
    color: #666;
    flex: 1;
}

.ingredient-summary p {
    line-height: 1.5;
}

.expiring-ingredients {
    background: #fff3cd;
    padding: clamp(8px, 1.5vw, 10px);
    border-radius: 6px;
    margin-top: 10px;
    color: #856404;
}

.missing-ingredients {
    margin-top: 10px;
}

/* ============================================
   NO RESULTS STATE
   ============================================ */
.no-results {
    padding: clamp(40px, 8vw, 60px) 20px;
    text-align: center;
}

.no-results-icon {
    font-size: clamp(3em, 8vw, 4em);
    margin-bottom: 20px;
    opacity: 0.5;
}

/* ============================================
   MODAL BASE STYLES
   ============================================ */
.recipe-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: clamp(10px, 3vw, 20px);
    /* CHANGED: Added padding-top to account for navbar */
    padding-top: calc(var(--navbar-height) + 10px);
    overflow-y: auto;
    backdrop-filter: blur(5px);
}

.recipe-modal-content {
    background: var(--bg-white);
    border-radius: var(--radius-lg);
    width: min(1200px, 95vw);
    /* CHANGED: Adjusted max-height to account for navbar */
    max-height: calc(90vh - var(--navbar-height));
    overflow-y: auto;
    position: relative;
    box-shadow: var(--shadow-xl);
    animation: modalSlideIn var(--transition-normal) ease-out;
    /* CHANGED: Added margin for better spacing */
    margin: auto 0;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-30px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.btn-close-modal {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    width: clamp(36px, 8vw, 44px);
    height: clamp(36px, 8vw, 44px);
    border-radius: 50%;
    font-size: clamp(20px, 5vw, 24px);
    cursor: pointer;
    z-index: 10;
    transition: all var(--transition-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.btn-close-modal:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1) rotate(90deg);
}

/* ============================================
   RECIPE DETAIL MODAL - RESPONSIVE
   ============================================ */
.recipe-detail-modal-styled {
    max-width: min(1000px, 95vw);
    padding: 0;
    border-radius: 15px;
    overflow: hidden;
}

.recipe-detail-layout-styled {
    display: grid;
    min-height: 500px;
}

/* XS-SM: Stack layout */
@media (max-width: 767px) {
    .recipe-detail-layout-styled {
        grid-template-columns: 1fr;
    }
}

/* MD: Side-by-side with smaller left panel */
@media (min-width: 768px) and (max-width: 1023px) {
    .recipe-detail-layout-styled {
        grid-template-columns: 280px 1fr;
    }
}

/* LG+: Full side-by-side */
@media (min-width: 1024px) {
    .recipe-detail-layout-styled {
        grid-template-columns: 350px 1fr;
        min-height: 700px;
    }
}

.recipe-detail-left {
    background: var(--bg-light);
    padding: clamp(15px, 3vw, 20px);
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2vw, 14px);
    align-items: stretch;
    overflow-y: auto;
    min-width: 0;  /* ✅ Allows flex item to shrink below content size */
}

/* ✅ Responsive layout for left sidebar */
@media (max-width: 767px) {
    .recipe-detail-left {
        max-height: 60vh;  /* ✅ Prevents cutting off on mobile */
        overflow-y: auto;
    }
}

@media (min-width: 768px) and (max-width: 1023px) {
    .recipe-detail-left {
        min-width: 250px;  /* ✅ Ensures minimum width on tablets */
        max-width: 280px;
    }
}

.recipe-image-wrapper {
    width: 100%;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
}

.detail-recipe-image-styled {
    width: 100%;
    height: clamp(200px, 30vw, 250px);
    object-fit: cover;
    display: block;
}

.recipe-modal-actions-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
}

.btn-sidebar {
    width: 100%;
    min-height: 48px;
    padding: clamp(12px, 2.5vw, 14px) clamp(20px, 4vw, 24px);
    border-radius: var(--radius-md);
    text-align: center;
    font-weight: 600;
    font-size: clamp(0.9em, 2vw, 0.95em);
    border: none;
    cursor: pointer;
    transition: all var(--transition-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-decoration: none;
    white-space: nowrap;
    box-sizing: border-box;
}

/* ✅ SINGLE definition for btn-icon-svg - NO margin-right */
.btn-icon-svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
}

.btn-sidebar.btn-danger {
    background: #e52d27;
    color: white;
}

.btn-sidebar.btn-danger:hover {
    background: #c9221c;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(229, 45, 39, 0.4);
}

.btn-sidebar.btn-success {
    background: var(--success);
    color: white;
}

.btn-sidebar.btn-success:hover {
    background: #218838;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

/* ✅ Keep span styling but ensure proper alignment */
.btn-sidebar span {
    display: flex;
    align-items: center;
    line-height: 1;
}

.match-card {
    background: linear-gradient(135deg, #ff9a56 0%, #ff6a6a 100%);
    padding: clamp(15px, 3vw, 20px);
    border-radius: var(--radius-md);
    color: white;
    text-align: center;
    box-shadow: 0 4px 12px rgba(255, 154, 86, 0.3);
}

.match-card.match-excellent {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.match-card.match-good {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.match-card.match-fair {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.match-percentage {
    font-size: clamp(2em, 5vw, 2.5em);
    font-weight: 700;
    line-height: 1;
    margin-bottom: 5px;
}

.match-text {
    font-size: clamp(0.9em, 2vw, 1em);
    font-weight: 500;
    opacity: 0.95;
}

.expiring-card {
    background: white;
    border: 2px solid #ff6b6b;
    padding: clamp(12px, 2.5vw, 15px);
    border-radius: var(--radius-md);
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 2vw, 12px);
}

.expiring-icon {
    font-size: clamp(1.5em, 3.5vw, 1.8em);
    flex-shrink: 0;
}

.expiring-text {
    flex: 1;
}

.expiring-text strong {
    display: block;
    color: var(--danger);
    font-size: clamp(0.9em, 2vw, 1em);
    margin-bottom: 5px;
}

.expiring-text p {
    color: #666;
    font-size: clamp(0.85em, 1.8vw, 0.9em);
    margin: 0;
    line-height: 1.4;
}

.recipe-detail-right {
    background: white;
    display: flex;
    flex-direction: column;
}

.recipe-title-section {
    padding: clamp(20px, 4vw, 25px) clamp(20px, 4vw, 30px);
    border-bottom: 2px solid #f0f0f0;
}

.recipe-modal-title {
    font-size: clamp(1.4rem, 3.5vw, 1.8rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 12px 0;
    line-height: 1.3;
}

.recipe-modal-badges {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
}

.recipe-scrollable-content {
    flex: 1;
    padding: clamp(20px, 4vw, 25px) clamp(20px, 4vw, 30px) clamp(25px, 5vw, 30px);
    overflow-y: auto;
    min-height: 0;
}

/* Responsive scrollable height */
@media (min-width: 1024px) {
    .recipe-scrollable-content {
        /* CHANGED: Account for navbar */
        max-height: calc(100vh - var(--navbar-height) - 350px);
        min-height: 450px;
    }
}

@media (max-height: 700px) {
    .recipe-scrollable-content {
        max-height: 50vh;
    }
}

.recipe-scrollable-content::-webkit-scrollbar {
    width: 8px;
}

.recipe-scrollable-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}

.recipe-scrollable-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 10px;
}

.recipe-scrollable-content::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
}

.section-heading {
    font-size: clamp(1.15rem, 2.8vw, 1.3rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 15px 0;
}

.ingredients-list-styled {
    list-style: none;
    padding: 0;
    margin: 0 0 clamp(25px, 5vw, 30px) 0;
}

.ingredient-item-styled {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 12px);
    padding: clamp(10px, 2vw, 12px) clamp(12px, 2.5vw, 15px);
    margin: 6px 0;
    border-radius: var(--radius-sm);
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    transition: all var(--transition-fast);
}

.ingredient-available-styled {
    background: #d4edda;
    border: 1px solid #c3e6cb;
}

.ingredient-expiring-styled {
    background: #fff9e6;
    border: 2px solid var(--warning);
    font-weight: 600;
}

.ingredient-missing-styled {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    opacity: 0.7;
}

.ingredient-check-icon {
    font-size: clamp(1.1em, 2.5vw, 1.2em);
    font-weight: bold;
    flex-shrink: 0;
    width: clamp(35px, 7vw, 40px);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-container {
    display: flex;
    align-items: center;
    gap: 3px;
}

.ingredient-available-styled .ingredient-check-icon {
    color: var(--success);
}

.ingredient-expiring-styled .ingredient-check-icon {
    color: #f39c12;
}

.ingredient-missing-styled .ingredient-check-icon {
    color: var(--danger);
}

.ingredient-text-styled {
    flex: 1;
    color: var(--text-primary);
    line-height: 1.5;
}

.instructions-styled {
    background: var(--bg-light);
    padding: clamp(15px, 3vw, 20px);
    border-radius: 10px;
    line-height: 1.8;
    color: #555;
    white-space: pre-wrap;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
}

/* ============================================
   CONFIRMATION MODAL - RESPONSIVE
   ============================================ */
.use-recipe-modal-new {
    max-width: min(850px, 95vw);
    /* CHANGED: Better max-height calculation */
    max-height: calc(90vh - var(--navbar-height) - 20px);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.recipe-confirmation-layout-new {
    padding: 0;
    display: flex;
    flex-direction: column;
    /* CHANGED: Better height management */
    max-height: calc(90vh - var(--navbar-height) - 20px);
    overflow: hidden;
}

.confirmation-header-new {
    display: grid;
    gap: clamp(15px, 4vw, 30px);
    padding: clamp(20px, 4vw, 30px);
    background: linear-gradient(135deg, var(--bg-light) 0%, var(--bg-white) 100%);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

/* XS-SM: Stack vertically */
@media (max-width: 599px) {
    .confirmation-header-new {
        grid-template-columns: 1fr;
        text-align: center;
    }
    
    .confirmation-recipe-image-redesign {
        max-width: 250px;
        margin: 0 auto;
    }
}

/* MD: Side by side */
@media (min-width: 600px) and (max-width: 1023px) {
    .confirmation-header-new {
        grid-template-columns: 180px 1fr;
    }
}

/* LG+: Full side by side */
@media (min-width: 1024px) {
    .confirmation-header-new {
        grid-template-columns: 200px 1fr;
    }
}

.confirmation-image-left {
    position: relative;
}

.confirmation-recipe-image-redesign {
    width: 100%;
    height: clamp(180px, 25vw, 200px);
    border-radius: var(--radius-md);
    object-fit: cover;
    box-shadow: var(--shadow-md);
}

.confirmation-info-right {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(10px, 2vw, 12px);
}

.confirmation-badges-top {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
}

@media (max-width: 599px) {
    .confirmation-badges-top {
        justify-content: center;
    }
}

.confirmation-recipe-name-new {
    font-size: clamp(1.3rem, 3.5vw, 1.75rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
}

.confirmation-stats {
    display: flex;
    align-items: stretch;
    gap: clamp(12px, 3vw, 20px);
    margin-top: var(--spacing-md);
    flex-wrap: wrap;
}

@media (max-width: 599px) {
    .confirmation-stats {
        justify-content: center;
    }
}

@media (max-width: 380px) {
    .confirmation-stats {
        gap: 10px;
    }
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-xs);
    min-width: clamp(60px, 15vw, 75px);
}

.stat-value {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    height: clamp(36px, 8vw, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-label {
    font-size: clamp(0.6rem, 1.5vw, 0.65rem);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    text-align: center;
}

.stat-divider {
    width: 1px;
    background: #dee2e6;
    align-self: stretch;
}

@media (max-width: 380px) {
    .stat-divider {
        display: none;
    }
}

.stat-value.match-excellent { color: var(--success); }
.stat-value.match-good { color: var(--info); }
.stat-value.match-fair { color: var(--warning); }
.stat-value.match-low { color: var(--danger); }
.stat-value.expiring-stat { color: #ff6b6b; }

/* CHANGED: Better scrolling for ingredients section - ISSUE #3 */
.ingredients-section-redesign {
    padding: clamp(20px, 4vw, 30px);
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    /* ADDED: Better height management for different screens */
    max-height: calc(90vh - var(--navbar-height) - 400px);
}

/* Responsive height adjustments */
@media (max-height: 800px) {
    .ingredients-section-redesign {
        max-height: calc(90vh - var(--navbar-height) - 350px);
    }
}

@media (max-height: 650px) {
    .ingredients-section-redesign {
        max-height: calc(90vh - var(--navbar-height) - 300px);
    }
}

@media (max-width: 599px) {
    .ingredients-section-redesign {
        max-height: calc(90vh - var(--navbar-height) - 450px);
    }
}

/* CHANGED: Better positioning for action buttons - ISSUE #3 */
.modal-actions-redesign {
    display: flex;
    gap: clamp(10px, 2vw, 12px);
    padding: clamp(15px, 3vw, 20px) clamp(20px, 4vw, 30px);
    border-top: 1px solid var(--border-color);
    background: var(--bg-light);
    flex-shrink: 0;
    /* ADDED: Ensure buttons are always visible */
    position: sticky;
    bottom: 0;
    z-index: 10;
}

.ingredients-section-redesign::-webkit-scrollbar {
    width: 6px;
}

.ingredients-section-redesign::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 10px;
}

.ingredients-section-redesign::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 10px;
}

.section-title-redesign {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: clamp(1.15rem, 2.8vw, 1.3rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 clamp(15px, 3vw, 20px) 0;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
}

.ingredients-count {
    font-size: clamp(0.65rem, 1.8vw, 0.7rem);
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-light);
    padding: 4px clamp(10px, 2vw, 12px);
    border-radius: 12px;
}

.ingredients-list-redesign {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.ingredient-card-redesign {
    background: white;
    border: 2px solid var(--border-color);
    border-radius: 10px;
    padding: clamp(12px, 2.5vw, 16px);
    transition: all var(--transition-fast);
}

.ingredient-card-redesign.is-expiring {
    border-color: var(--warning);
    background: #fffbf0;
}

.ingredient-card-redesign.is-available {
    border-color: #d4edda;
}

.ingredient-card-redesign.is-missing {
    border-color: #f8d7da;
    background: #fef5f6;
    opacity: 0.7;
}

.ingredient-card-redesign.is-unchecked {
    opacity: 0.6;
}

.ingredient-card-redesign:hover:not(.is-missing) {
    box-shadow: var(--shadow-sm);
}

.ingredient-card-main {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 14px);
}

@media (max-width: 599px) {
    .ingredient-card-main {
        flex-wrap: wrap;
    }
}

.ingredient-checkbox-wrapper {
    position: relative;
    flex-shrink: 0;
}

.custom-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
}

.checkbox-label {
    display: block;
    width: 22px;
    height: 22px;
    border: 2px solid #cbd5e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
}

.custom-checkbox:checked + .checkbox-label {
    background: var(--primary-green);
    border-color: var(--primary-green);
}

.custom-checkbox:checked + .checkbox-label::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
}

.custom-checkbox:disabled + .checkbox-label {
    background: var(--border-color);
    border-color: #dee2e6;
    cursor: not-allowed;
}

.custom-checkbox:focus + .checkbox-label {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
}

.ingredient-status-indicator {
    flex-shrink: 0;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    font-size: 1em;
}

.badge-expiring {
    background: #fff3cd;
    color: #856404;
}

.badge-available {
    background: #d4edda;
    color: #155724;
}

.badge-missing {
    background: #f8d7da;
    color: #721c24;
}

.ingredient-info-wrapper {
    flex: 1;
    min-width: 0;
}

.ingredient-name-redesign {
    font-size: clamp(0.95rem, 2vw, 1rem);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
}

.ingredient-measure-redesign {
    font-size: clamp(0.8rem, 1.8vw, 0.875rem);
    color: var(--text-secondary);
}

.ingredient-quantity-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-shrink: 0;
}

@media (max-width: 599px) {
    .ingredient-quantity-wrapper {
        width: 100%;
        justify-content: flex-start;
        margin-top: var(--spacing-xs);
    }
}

.quantity-input-redesign {
    width: clamp(60px, 15vw, 70px);
    padding: clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 10px);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-sm);
    text-align: center;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    font-weight: 600;
    color: var(--text-primary);
    transition: all var(--transition-fast);
}

.quantity-input-redesign:focus {
    border-color: var(--primary-green);
    outline: none;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.quantity-input-redesign:disabled {
    background: var(--bg-light);
    cursor: not-allowed;
    opacity: 0.6;
}

.quantity-unit-redesign {
    font-size: clamp(0.8rem, 1.8vw, 0.875rem);
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 30px;
}

.unit-warning {
    font-size: 1.2em;
    cursor: help;
}

@media (max-width: 599px) {
    .modal-actions-redesign {
        flex-direction: column;
    }
}

.btn-redesign {
    flex: 1;
    min-height: 48px;
    padding: clamp(12px, 2.5vw, 14px) clamp(20px, 4vw, 24px);
    font-size: clamp(1rem, 2.2vw, 1.05rem);
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
}

.btn-redesign:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-cancel-redesign {
    background: white;
    color: var(--text-secondary);
    border: 2px solid #dee2e6;
}

.btn-cancel-redesign:hover:not(:disabled) {
    background: var(--bg-light);
    border-color: #adb5bd;
}

.btn-cancel-redesign:focus {
    outline: 2px solid var(--text-secondary);
    outline-offset: 2px;
}

.btn-confirm-redesign {
    background: var(--primary-green);
    color: white;
}

.btn-confirm-redesign:hover:not(:disabled) {
    background: var(--primary-green-dark);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-confirm-redesign:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
}

.btn-icon {
    font-size: 1.1em;
}

/* ============================================
   UNDO TOAST - RESPONSIVE
   ============================================ */
.undo-toast-improved {
    position: fixed;
    z-index: 2000;
    animation: slideInRight var(--transition-slow) cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Desktop positioning */
@media (min-width: 768px) {
    .undo-toast-improved {
        bottom: 30px;
        right: 30px;
        max-width: 450px;
        width: auto;
    }
}

/* Mobile positioning */
@media (max-width: 767px) {
    .undo-toast-improved {
        bottom: 20px;
        right: 20px;
        left: 20px;
        max-width: none;
        width: auto;
    }
}

@keyframes slideInRight {
    from {
        transform: translateX(120%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.undo-toast-card {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    border: 1px solid var(--border-color);
}

/* Progress Bar */
.undo-progress-bar {
    height: 4px;
    background: var(--border-color);
    overflow: hidden;
}

.undo-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    transition: width 1s linear;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

/* Content */
.undo-content-wrapper {
    padding: clamp(16px, 3vw, 20px);
}

.undo-message-section {
    display: flex;
    gap: clamp(12px, 3vw, 16px);
    align-items: flex-start;
    margin-bottom: clamp(12px, 2.5vw, 16px);
}

.undo-icon-circle {
    flex-shrink: 0;
    width: clamp(40px, 10vw, 48px);
    height: clamp(40px, 10vw, 48px);
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.checkmark-icon {
    width: clamp(24px, 6vw, 28px);
    height: clamp(24px, 6vw, 28px);
    stroke-width: 3;
}

.checkmark-circle {
    stroke: white;
    stroke-width: 3;
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
    stroke: white;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}

@keyframes stroke {
    to {
        stroke-dashoffset: 0;
    }
}

.undo-text-content {
    flex: 1;
    min-width: 0;
}

.undo-title {
    font-size: clamp(1rem, 2.2vw, 1.1rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px 0;
}

.undo-subtitle {
    font-size: clamp(0.85rem, 1.9vw, 0.9rem);
    color: var(--text-secondary);
    margin: 0 0 8px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.undo-timer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: clamp(0.8rem, 1.8vw, 0.85rem);
    color: var(--primary-green);
    font-weight: 600;
    margin: 0;
}

.clock-icon {
    width: 16px;
    height: 16px;
    stroke-width: 2;
}

/* Actions */
.undo-actions-section {
    display: flex;
    gap: var(--spacing-sm);
}

@media (max-width: 479px) {
    .undo-actions-section {
        flex-direction: column;
    }
}

.undo-btn {
    padding: clamp(10px, 2vw, 12px) clamp(16px, 3vw, 20px);
    border-radius: 10px;
    font-weight: 600;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    min-height: 44px;
}

.undo-btn-primary {
    flex: 1;
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.undo-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.undo-btn-primary:active {
    transform: translateY(0);
}

.undo-btn-primary:focus {
    outline: 3px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
}

.undo-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
}

.undo-btn-dismiss {
    width: 44px;
    height: 44px;
    padding: 0;
    background: var(--bg-light);
    color: var(--text-secondary);
}

@media (max-width: 479px) {
    .undo-btn-dismiss {
        width: 100%;
    }
}

.undo-btn-dismiss:hover {
    background: var(--border-color);
    color: var(--text-primary);
}

.undo-btn-dismiss:focus {
    outline: 2px solid var(--text-secondary);
    outline-offset: 2px;
}

.close-icon {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
}

/* ============================================
   SUCCESS NOTIFICATION (TOP CENTER)
   ============================================ */
.success-notification-top {
    position: fixed;
    z-index: 2001;
}

/* Desktop positioning */
@media (min-width: 768px) {
    .success-notification-top {
        /* CHANGED: Account for navbar */
        top: calc(var(--navbar-height) + 20px);
        left: 50%;
        transform: translateX(-50%);
        max-width: 500px;
        width: auto;
    }
}

/* Mobile positioning */
@media (max-width: 767px) {
    .success-notification-top {
        /* CHANGED: Account for navbar */
        top: calc(var(--navbar-height) + 10px);
        left: 10px;
        right: 10px;
        transform: none;
        max-width: none;
        width: auto;
    }
}

.success-notification-card {
    background: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xl);
    border-left: 4px solid var(--primary-green);
    overflow: hidden;
}

.success-notification-content {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 12px);
    padding: clamp(14px, 3vw, 16px) clamp(16px, 3vw, 20px);
}

.success-icon-wrapper {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.success-icon {
    width: 24px;
    height: 24px;
    stroke: white;
    stroke-width: 2.5;
}

.success-message-text {
    flex: 1;
    margin: 0;
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
}

.success-dismiss-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    padding: 0;
}

.success-dismiss-btn:hover {
    background: #f5f5f5;
}

.success-dismiss-btn:focus {
    outline: 2px solid var(--primary-green);
    outline-offset: 2px;
}

.success-dismiss-btn svg {
    width: 16px;
    height: 16px;
    stroke: var(--text-secondary);
}

/* Slide down animation */
.slide-down-enter-active {
    animation: slideDown var(--transition-slow) cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.slide-down-leave-active {
    animation: slideUp var(--transition-normal) ease-in;
}

@keyframes slideDown {
    from {
        transform: translateX(-50%) translateY(-100%);
        opacity: 0;
    }
    to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    to {
        transform: translateX(-50%) translateY(-100%);
        opacity: 0;
    }
}

@media (max-width: 767px) {
    @keyframes slideDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(-100%);
            opacity: 0;
        }
    }
}

/* ============================================
   EMPTY STATE - RESPONSIVE
   ============================================ */
.empty-state-container {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 5vw, 40px) clamp(15px, 3vw, 20px);
}

.empty-state-card {
    max-width: 800px;
    width: 100%;
    background: white;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: clamp(30px, 6vw, 50px) clamp(20px, 4vw, 40px);
    text-align: center;
    animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Visual Section */
.empty-state-visual {
    margin-bottom: clamp(20px, 5vw, 30px);
    position: relative;
    height: clamp(120px, 25vw, 180px);
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-state-icon-wrapper {
    position: relative;
    display: inline-block;
}

.empty-state-icon-large {
    font-size: clamp(70px, 15vw, 120px);
    display: block;
    animation: float 3s ease-in-out infinite;
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.1));
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
}

/* Content Section */
.empty-state-content {
    margin-bottom: clamp(30px, 6vw, 40px);
}

.empty-state-title {
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 15px 0;
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-dark) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.empty-state-description {
    font-size: clamp(1rem, 2.2vw, 1.1rem);
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: 600px;
    margin: 0 auto clamp(20px, 4vw, 30px);
}

/* Feature Highlights */
.empty-state-features {
    display: flex;
    justify-content: center;
    gap: clamp(15px, 4vw, 30px);
    flex-wrap: wrap;
    margin: clamp(20px, 4vw, 30px) 0;
}

.feature-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: clamp(10px, 2vw, 12px) clamp(16px, 3vw, 20px);
    background: var(--bg-light);
    border-radius: 25px;
    transition: all var(--transition-normal);
}

.feature-item:hover {
    background: var(--border-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.feature-icon {
    font-size: clamp(1.3em, 3vw, 1.5em);
}

.feature-text {
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    font-weight: 600;
    color: var(--text-primary);
}

/* Call to Action Buttons */
.empty-state-actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: center;
    flex-wrap: wrap;
    margin-top: clamp(20px, 4vw, 30px);
}

@media (max-width: 599px) {
    .empty-state-actions {
        flex-direction: column;
    }
}

.btn-empty-state {
    padding: clamp(14px, 3vw, 16px) clamp(24px, 5vw, 32px);
    border-radius: var(--radius-md);
    font-size: clamp(1rem, 2.2vw, 1.05rem);
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all var(--transition-normal);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    text-decoration: none;
    box-shadow: var(--shadow-md);
    min-height: 48px;
    justify-content: center;
}

@media (max-width: 599px) {
    .btn-empty-state {
        width: 100%;
    }
}

.btn-primary-empty {
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-dark) 100%);
    color: white;
}

.btn-primary-empty:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-secondary-empty {
    background: white;
    color: var(--primary-green);
    border: 2px solid var(--primary-green);
}

.btn-secondary-empty:hover {
    background: var(--bg-light);
    transform: translateY(-2px);
}

.btn-icon-left {
    width: 20px;
    height: 20px;
    stroke-width: 2;
}

/* Preview Section */
.empty-state-preview {
    margin-top: clamp(40px, 8vw, 50px);
    padding-top: clamp(30px, 6vw, 40px);
    border-top: 2px dashed var(--border-color);
}

.preview-label {
    font-size: clamp(0.85rem, 1.9vw, 0.9rem);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
}

.preview-cards {
    display: grid;
    gap: clamp(15px, 3vw, 20px);
    max-width: 600px;
    margin: 0 auto;
}

/* XS-SM: 1 column */
@media (max-width: 599px) {
    .preview-cards {
        grid-template-columns: 1fr;
    }
}

/* MD+: 3 columns */
@media (min-width: 600px) {
    .preview-cards {
        grid-template-columns: repeat(3, 1fr);
    }
}

.preview-card {
    background: linear-gradient(135deg, var(--bg-light) 0%, var(--bg-white) 100%);
    padding: clamp(20px, 4vw, 24px);
    border-radius: var(--radius-md);
    border: 2px solid var(--border-color);
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
}

.preview-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary-green) 0%, var(--primary-green-dark) 100%);
    transform: scaleX(0);
    transition: transform var(--transition-normal);
}

.preview-card:hover {
    border-color: var(--primary-green);
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
}

.preview-card:hover::before {
    transform: scaleX(1);
}

.preview-badge {
    display: inline-block;
    padding: 4px 12px;
    background: var(--border-color);
    border-radius: 12px;
    font-size: clamp(0.7rem, 1.6vw, 0.75rem);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.preview-image {
    font-size: clamp(2.5em, 6vw, 3em);
    margin: clamp(12px, 3vw, 15px) 0;
}

.preview-title {
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

/* how it works modal */
.how-it-works-modal {
    max-width: min(900px, 95vw);
    /* CHANGED: Account for navbar */
    max-height: calc(90vh - var(--navbar-height) - 20px);
    padding: 0;
    animation: modalSlideIn var(--transition-normal) ease-out;
}

.how-it-works-content {
    padding: clamp(25px, 5vw, 40px) clamp(15px, 4vw, 40px);
}

/* Header */
.how-it-works-header {
    text-align: center;
    margin-bottom: clamp(30px, 6vw, 40px);
}

.how-it-works-icon-badge {
    width: clamp(60px, 15vw, 80px);
    height: clamp(60px, 15vw, 80px);
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-md);
    box-shadow: 0 8px 24px rgba(76, 175, 80, 0.3);
    animation: pulse 2s ease-in-out infinite;
}

.badge-icon {
    font-size: clamp(2em, 5vw, 2.5em);
}

.how-it-works-title {
    font-size: clamp(1.4rem, 4vw, 2rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 10px 0;
}

.how-it-works-subtitle {
    font-size: clamp(1rem, 2.2vw, 1.1rem);
    color: var(--text-secondary);
    margin: 0;
}

/* Steps */
.how-it-works-steps {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: clamp(30px, 6vw, 40px);
    overflow-x: auto;
    padding: var(--spacing-md) 0;
}

/* XS-MD: Stack vertically */
@media (max-width: 1023px) {
    .how-it-works-steps {
        flex-direction: column;
        gap: var(--spacing-md);
    }
}

/* LG+: Horizontal */
@media (min-width: 1024px) {
    .how-it-works-steps {
        flex-direction: row;
    }
}

.step-card {
    background: white;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: clamp(20px, 4vw, 24px);
    min-width: clamp(160px, 35vw, 180px);
    flex: 1;
    position: relative;
    transition: all var(--transition-normal);
}

.step-card:hover {
    border-color: var(--primary-green);
    box-shadow: 0 8px 24px rgba(76, 175, 80, 0.15);
    transform: translateY(-4px);
}

.step-number {
    position: absolute;
    top: -12px;
    left: 20px;
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: clamp(0.85em, 2vw, 0.9em);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.step-content {
    text-align: center;
}

.step-icon {
    font-size: clamp(2em, 5vw, 2.5em);
    margin-bottom: 12px;
    display: block;
}

.step-title {
    font-size: clamp(1rem, 2.2vw, 1.1rem);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
}

.step-description {
    font-size: clamp(0.85rem, 1.9vw, 0.9rem);
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
}

.step-arrow {
    font-size: clamp(1.5em, 4vw, 2em);
    color: var(--primary-green);
    flex-shrink: 0;
    animation: arrowBounce 1.5s ease-in-out infinite;
}

@keyframes arrowBounce {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(5px); }
}

/* Vertical arrow on mobile */
@media (max-width: 1023px) {
    .step-arrow {
        transform: rotate(90deg);
        margin: -10px 0;
    }
    
    @keyframes arrowBounce {
        0%, 100% { transform: rotate(90deg) translateX(0); }
        50% { transform: rotate(90deg) translateX(5px); }
    }
}

/* Features Section */
.how-it-works-features {
    background: var(--bg-light);
    border-radius: var(--radius-lg);
    padding: clamp(25px, 5vw, 30px);
    margin-bottom: clamp(25px, 5vw, 30px);
}

.features-title {
    font-size: clamp(1.15rem, 2.8vw, 1.3rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-md) 0;
    text-align: center;
}

.features-grid {
    display: grid;
    gap: var(--spacing-sm);
}

/* XS: 1 column */
@media (max-width: 599px) {
    .features-grid {
        grid-template-columns: 1fr;
    }
}

/* SM-MD: 2 columns */
@media (min-width: 600px) and (max-width: 1023px) {
    .features-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* LG+: 3 columns */
@media (min-width: 1024px) {
    .features-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.feature-box {
    background: white;
    padding: clamp(14px, 3vw, 16px) clamp(16px, 3vw, 20px);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 12px);
    transition: all var(--transition-normal);
    border: 2px solid transparent;
}

.feature-box:hover {
    border-color: var(--primary-green);
    transform: translateX(4px);
    box-shadow: var(--shadow-sm);
}

.feature-box-icon {
    font-size: clamp(1.5em, 3.5vw, 1.8em);
    flex-shrink: 0;
}

.feature-box-text {
    font-size: clamp(0.9rem, 2vw, 0.95rem);
    color: var(--text-primary);
    font-weight: 500;
}

/* Footer */
.how-it-works-footer {
    text-align: center;
}

.btn-modal-cta {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: clamp(14px, 3vw, 16px) clamp(24px, 5vw, 32px);
    background: linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-light) 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: clamp(1rem, 2.2vw, 1.1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    text-decoration: none;
    box-shadow: var(--shadow-md);
    min-height: 48px;
    justify-content: center;
}

@media (max-width: 599px) {
    .btn-modal-cta {
        width: 100%;
    }
}

.btn-modal-cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-modal-cta:focus {
    outline: 3px solid rgba(76, 175, 80, 0.5);
    outline-offset: 2px;
}

/* ============================================
   LANDSCAPE ORIENTATION OPTIMIZATIONS
   ============================================ */
@media (max-width: 900px) and (max-height: 500px) and (orientation: landscape) {
    .recipe-modal-content {
        max-height: 95vh;
    }
    
    .confirmation-header-new {
        padding: clamp(15px, 3vw, 20px);
    }
    
    .ingredients-section-redesign {
        max-height: 40vh;
    }
    
    .recipe-scrollable-content {
        max-height: 45vh;
    }
}

/* ============================================
   TOUCH TARGET ENHANCEMENTS (MOBILE)
   ============================================ */
@media (max-width: 767px) {
    .btn-empty-state,
    .btn-sidebar,
    .undo-btn,
    .btn-redesign,
    .recipe-card {
        min-height: 48px;
    }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Focus visible for keyboard navigation */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
.recipe-card:focus-visible {
    outline: 3px solid var(--primary-green);
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .recipe-card,
    .btn-sidebar,
    .undo-btn,
    .btn-redesign {
        border: 2px solid currentColor;
    }
}

/* ============================================
   PRINT STYLES
   ============================================ */
@media print {
    .filters-section,
    .btn-close-modal,
    .recipe-modal-actions-sidebar,
    .undo-toast-improved,
    .success-notification-top {
        display: none !important;
    }
    
    .recipe-modal {
        position: static;
        background: white;
    }
    
    .recipe-modal-content {
        box-shadow: none;
    }
    
    .recipe-container {
        max-width: 100%;
    }
}
</style>